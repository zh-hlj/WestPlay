//! Bilibili (www.bilibili.com), run hidden under the cab: its own page, its own login (a QR code in a window on
//! the PC), and its own API, read from the page (`bilibili.js`). The app's items, answers and playback are the
//! shapes the NetEase Cloud Music service uses (`netease.rs`): the cabin's music app shows it as another source.
//!
//! TODO(verify): Bilibili's own API (`api.bilibili.com`: search, view, playurl) as the page asks it: checked
//! 2026-10-28 (search/view/playurl answer; a video's DASH audio plays in the page). Its CDN has no CORS: the page
//! fetches the audio's bytes itself (this profile's browser has CORS off) and plays them as a blob, so the
//! truck's speakers take its sound as the other services' (cab_sound.js).

use std::cell::RefCell;
use std::path::Path;

pub use crate::netease::State;
use crate::netease::{Answer, Playback, Question, Repeat};
use crate::signin::{self, Confirming, Progress, SignInWindow};
use crate::speakers::{self, Equalizer, Head, Speaker};
use crate::webview::{self, OffscreenWebView, Stage};

/// Bilibili's page (its own web player; the account's own sign-in is a dialog of this page).
pub const HOME: &str = "https://www.bilibili.com/";

/// The CORS-free environment its page needs to fetch its audio's bytes (its CDN has no CORS: the page fetches
/// them itself, as a blob): this profile's browser only (the other services have their own).
const CORS_OFF: &str = "--disable-web-security";

/// What the cabin app asks of Bilibili (`bilibili` in ui/src/shared/host.ts; the same actions as `netease`'s).
#[derive(Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "action", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Command {
    /// Run (hidden), saying whether it's signed in: the Bilibili source is open.
    Start,
    /// Its sign-in, in a window on the desktop (a QR code to scan, as its page has it).
    SignIn,
    /// Forgets its cookies: its page starts signed out.
    SignOut,
    Ask {
        id: u32,
        question: Question,
    },
    /// A song (`song`: its mid), from a list (`playlist`: its id, if it was in one).
    Play {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        song: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        playlist: Option<String>,
    },
    Pause,
    Resume,
    Next,
    Previous,
    Seek {
        seconds: f64,
    },
    Volume {
        percent: f64,
    },
    Shuffle {
        on: bool,
    },
    Repeat {
        mode: Repeat,
    },
}

/// What Bilibili's page says (`bilibili.js`).
#[derive(Debug, PartialEq)]
enum Message {
    /// The page loaded (anew): the questions it missed are asked again.
    Ready,
    State(State),
    Answer(Box<Answer>),
    Playback(Option<Box<Playback>>),
    /// The page's own debug line (the account and the playurl it got), for the host's log.
    Debug(String),
}

/// What the host takes from Bilibili for the cabin page and the log.
#[derive(Debug, PartialEq)]
pub enum Report {
    /// The music's spectrum, while the cab's Equalizer asks for it ([`speakers::read_spectrum`]).
    Spectrum(Vec<u8>),
    /// The sign-in window opened (`true`) or closed.
    SignInWindow(bool),
    /// The window closed signed in, and its page is yet to say it's signed in (`true`), or it has (or took too
    /// long: `false`).
    Confirming(bool),
    State(State),
    Answer(Box<Answer>),
    Playback(Option<Box<Playback>>),
}

pub struct Bilibili {
    view: OffscreenWebView,
    sign_in: RefCell<Option<SignInWindow>>,
    confirming: Confirming,
    pending: RefCell<Vec<Report>>,
    /// The app's questions not answered yet: asked again as the page is ready anew.
    unanswered: RefCell<Vec<(u32, String)>>,
    /// What the page was told of the cab, sent again when it loads anew.
    told: RefCell<Told>,
}

/// What the host tells Bilibili's page of the cab (never the cabin page's to send): the truck's speakers (`None`:
/// as it is, a truck whose speakers aren't known), the driver's head, and the camera outside (its distance,
/// metres; 0: not known). As NetEase's (netease.rs).
#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(tag = "action", rename_all = "camelCase")]
enum Cab {
    Speakers {
        speakers: Option<Vec<Speaker>>,
    },
    Head {
        #[serde(flatten)]
        head: Head,
    },
    Outside {
        on: bool,
        distance: f32,
    },
    /// The player's tone (the cab's Settings › Sound): bass, mid and treble, dB each.
    Equalizer {
        #[serde(flatten)]
        equalizer: Equalizer,
    },
    /// The music's spectrum wanted (the cab's Equalizer open) or not: the page says it as it plays.
    Spectrum {
        on: bool,
    },
}

/// What the page was told last of the cab (sent again to a page that loaded anew): the truck, and the speakers,
/// head, camera and tone messages.
#[derive(Debug, Default)]
struct Told {
    truck: Option<String>,
    head: Option<Head>,
    camera: Option<(bool, f32)>,
    equalizer: Option<Equalizer>,
    spectrum: Option<bool>,
    messages: [Option<String>; 5],
}

impl Bilibili {
    /// Starts it, hidden, on this service's own profile (`user_data`), and asks its page.
    pub fn start(stage: &Stage, width: u32, height: u32, user_data: &Path) -> Result<Self, webview::Error> {
        // CORS off for this profile only: its page fetches the audio's bytes (its CDN has no CORS) to play them
        // from a blob through the truck's speakers.
        let view = OffscreenWebView::new_with_arguments(stage, width, height, user_data, CORS_OFF)?;
        view.log_as("bilibili")?;
        view.show(false)?;
        stage.add(&view, false)?;
        // The truck speakers' sound first: the page's script makes its own of it.
        view.add_startup_script(concat!(include_str!("cab_sound.js"), "\n", include_str!("bilibili.js")))?;
        view.navigate(HOME)?;
        Ok(Self {
            view,
            sign_in: RefCell::new(None),
            confirming: Confirming::default(),
            pending: RefCell::new(Vec::new()),
            unanswered: RefCell::new(Vec::new()),
            told: RefCell::default(),
        })
    }

    /// Its WebView, for what needs it (the GPU it draws on, its profile).
    pub fn view(&self) -> &OffscreenWebView {
        &self.view
    }

    /// The app's command, for its page.
    pub fn command(&self, command: &Command) -> windows::core::Result<()> {
        match command {
            Command::Start => Ok(()),
            Command::SignOut => {
                self.view.delete_cookies()?;
                self.view.navigate(HOME)
            }
            Command::Ask { id, question } => {
                if !question.is_sound() {
                    // Not a question for Bilibili: failed at once, so the app isn't left waiting.
                    let answer = Answer { answer: *id, failed: true, ..Default::default() };
                    self.pending.borrow_mut().push(Report::Answer(Box::new(answer)));
                    return Ok(());
                }
                let asked = serde_json::json!({ "action": "ask", "id": id, "question": question }).to_string();
                self.unanswered.borrow_mut().push((*id, asked.clone()));
                self.view.post_json(&asked)
            }
            Command::SignIn => {
                self.open_sign_in();
                Ok(())
            }
            other => {
                let json = serde_json::to_string(other).unwrap_or_default();
                self.view.post_json(&json)
            }
        }
    }

    /// Its sign-in window, opened (or brought forward if it is): Bilibili's own login page, a QR code to scan.
    fn open_sign_in(&self) {
        let mut sign_in = self.sign_in.borrow_mut();
        if let Some(window) = sign_in.as_ref() {
            window.bring_forward();
            return;
        }
        match SignInWindow::open(self.view.environment(), &signin::BILIBILI) {
            Ok(window) => {
                *sign_in = Some(window);
                self.pending.borrow_mut().push(Report::SignInWindow(true));
            }
            // Not opened: the page's own sign-in may still work when it's clicked.
            Err(_) => {}
        }
    }

    /// The truck (its SDK model id), the driver's head, and whether the camera is outside the cab and how far
    /// (metres; 0: not known): the page is told the truck's speakers as the truck changes, the head as it moves,
    /// the camera as it goes in or out or a quarter metre further, the tone as it's set and the spectrum as it's
    /// wanted (as NetEase's: netease.rs).
    pub fn cab(
        &self,
        truck: &str,
        head: Head,
        outside: bool,
        distance: f32,
        equalizer: Equalizer,
        spectrum: bool,
    ) -> windows::core::Result<()> {
        let mut told = self.told.borrow_mut();
        // The head first: the speakers' loudness is set from where it is as they're placed.
        if told.head != Some(head) && head.is_sound() {
            told.head = Some(head);
            let message = serde_json::to_string(&Cab::Head { head }).unwrap_or_default();
            told.messages[1] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        if told.truck.as_deref() != Some(truck) {
            told.truck = Some(truck.to_owned());
            let speakers = speakers::in_truck(truck).map(<[_]>::to_vec);
            let message = serde_json::to_string(&Cab::Speakers { speakers }).unwrap_or_default();
            told.messages[0] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        let camera = (outside, if outside { (distance * 4.0).round() / 4.0 } else { 0.0 });
        if told.camera != Some(camera) && camera.1.is_finite() {
            told.camera = Some(camera);
            let message = serde_json::to_string(&Cab::Outside { on: camera.0, distance: camera.1 }).unwrap_or_default();
            told.messages[2] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        if told.equalizer != Some(equalizer) {
            told.equalizer = Some(equalizer);
            let message = serde_json::to_string(&Cab::Equalizer { equalizer }).unwrap_or_default();
            told.messages[3] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        if told.spectrum != Some(spectrum) {
            told.spectrum = Some(spectrum);
            let message = serde_json::to_string(&Cab::Spectrum { on: spectrum }).unwrap_or_default();
            told.messages[4] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        Ok(())
    }

    /// What its page said since the last call, and the sign-in window opening or closing (signed in, the page
    /// loads again, signed in).
    pub fn take_reports(&self) -> Vec<Report> {
        let mut reports = std::mem::take(&mut *self.pending.borrow_mut());
        let progress = self.sign_in.borrow().as_ref().map(SignInWindow::progress);
        if let Some(progress @ (Progress::SignedIn | Progress::Closed)) = progress {
            self.sign_in.borrow_mut().take();
            reports.push(Report::SignInWindow(false));
            if progress == Progress::SignedIn {
                let _ = self.view.navigate(HOME);
                self.confirming.start();
                reports.push(Report::Confirming(true));
            }
        }
        for message in self.view.take_page_messages() {
            if let Some(bars) = speakers::read_spectrum(&message) {
                reports.push(Report::Spectrum(bars));
                continue;
            }
            match read_message(&message) {
                Some(Message::Ready) => {
                    // A page loaded anew: the cab as it is, and the questions it missed.
                    for told in self.told.borrow().messages.iter().flatten() {
                        let _ = self.view.post_json(told);
                    }
                    for (_, sent) in self.unanswered.borrow().iter() {
                        let _ = self.view.post_json(sent);
                    }
                }
                Some(Message::State(state)) => reports.push(Report::State(state)),
                Some(Message::Answer(answer)) => {
                    self.unanswered.borrow_mut().retain(|(id, _)| *id != answer.answer);
                    reports.push(Report::Answer(answer));
                }
                Some(Message::Playback(playback)) => reports.push(Report::Playback(playback)),
                Some(Message::Debug(said)) => log!("[bilibili] debug: {said}"),
                None => {}
            }
        }
        let signed_in = reports.iter().rev().find_map(|report| match report {
            Report::State(state) => Some(state.signed_in),
            _ => None,
        });
        if self.confirming.ended(signed_in) {
            reports.push(Report::Confirming(false));
        }
        reports
    }

    /// Whether the WebView failed since the last call (it's then closed and started again when needed).
    pub fn failed(&self) -> bool {
        self.view.take_failure().is_some()
    }

    /// Takes the WebView off the frame; it closes as it's dropped.
    pub fn close(self, stage: &Stage) {
        let _ = stage.remove(&self.view);
    }
}

fn read_message(message: &str) -> Option<Message> {
    let value: serde_json::Value = serde_json::from_str(message).ok()?;
    if value.get("ready").and_then(serde_json::Value::as_bool) == Some(true) {
        return Some(Message::Ready);
    }
    if let Some(said) = value.get("debug").and_then(serde_json::Value::as_str) {
        return Some(Message::Debug(said.chars().take(500).collect()));
    }
    if let Some(answer) = value.get("answer") {
        // `bilibili.js`'s own shape: the payload under `answer`, its id with it.
        let id = answer.get("id").and_then(serde_json::Value::as_u64)?;
        let id = u32::try_from(id).ok()?;
        let mut fields = answer.clone();
        if let Some(object) = fields.as_object_mut() {
            object.insert("answer".into(), serde_json::Value::from(id));
        }
        return Some(Message::Answer(Box::new(
            serde_json::from_value::<Answer>(fields)
                .unwrap_or_else(|_| Answer { answer: id, failed: true, ..Default::default() }),
        )));
    }
    if let Some(playback) = value.get("playback") {
        if playback.is_null() {
            return Some(Message::Playback(None));
        }
        return serde_json::from_value::<Playback>(playback.clone())
            .ok()
            .map(|playback| Message::Playback(Some(Box::new(playback))));
    }
    let state = value.get("state").cloned().unwrap_or(value);
    serde_json::from_value::<State>(state).ok().map(Message::State)
}

/// `{"type":"bilibili","signedIn":true,"playing":false,"signingIn":false,"vip":…}` for the cabin page
/// (`null` fields when Bilibili isn't running).
pub fn state_message(state: Option<&State>, signing_in: bool) -> String {
    serde_json::json!({
        "type": "bilibili",
        "signedIn": state.map(|s| s.signed_in),
        "playing": state.map(|s| s.playing),
        "vip": state.and_then(|s| s.vip.as_deref()),
        "signingIn": signing_in,
    })
    .to_string()
}

/// `{"type":"bilibiliAnswer","id":…,…}`: Bilibili's answer to the app's question.
pub fn answer_message(answer: &Answer) -> String {
    let mut message = serde_json::to_value(answer).unwrap_or_default();
    message["type"] = "bilibiliAnswer".into();
    message.to_string()
}

/// `{"type":"bilibiliPlayback","playback":{…}}` (`null`: nothing plays).
pub fn playback_message(playback: Option<&Playback>) -> String {
    serde_json::json!({ "type": "bilibiliPlayback", "playback": playback }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::netease::State;

    #[test]
    fn reads_the_cabin_pages_commands() {
        let command: Command =
            serde_json::from_str(r#"{"action":"ask","id":3,"question":{"ask":"search","query":"晴天"}}"#).unwrap();
        assert!(matches!(command, Command::Ask { id: 3, question: Question::Search { .. } }));
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"play","song":"0039MnYb0qxYhV"}"#).unwrap(),
            Command::Play { song: Some("0039MnYb0qxYhV".into()), playlist: None }
        );
        assert_eq!(serde_json::from_str::<Command>(r#"{"action":"pause"}"#).unwrap(), Command::Pause);
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"repeat","mode":"all"}"#).unwrap(),
            Command::Repeat { mode: Repeat::All }
        );
    }

    #[test]
    fn passes_the_page_its_commands_as_the_app_sent_them() {
        assert_eq!(
            serde_json::to_string(&Command::Ask { id: 2, question: Question::Home }).unwrap(),
            r#"{"action":"ask","id":2,"question":{"ask":"home"}}"#
        );
        assert_eq!(
            serde_json::to_string(&Command::Play { song: None, playlist: Some("7512846558".into()) }).unwrap(),
            r#"{"action":"play","playlist":"7512846558"}"#
        );
    }

    #[test]
    fn reads_bilibilis_page() {
        assert_eq!(read_message(r#"{"ready":true}"#), Some(Message::Ready));
        assert_eq!(
            read_message(r#"{"state":{"signedIn":true,"playing":false,"vip":"VIP"}}"#),
            Some(Message::State(State { signed_in: true, playing: false, vip: Some("VIP".into()) }))
        );
        assert_eq!(read_message(r#"{"playback":null}"#), Some(Message::Playback(None)));
        assert_eq!(read_message(r#"{"something":1}"#), None);
    }

    #[test]
    fn reads_an_answer() {
        let page = r#"{"answer":{"id":7,"search":{"songs":[{"id":"0039MnYb0qxYhV","name":"晴天","artists":["周杰伦"],"album":"叶惠美","durationMs":269000}]}}}"#;
        let Some(Message::Answer(answer)) = read_message(page) else { panic!("not an answer") };
        assert_eq!(answer.answer, 7);
        assert_eq!(answer.search.as_ref().map(|results| results.songs.len()), Some(1));
        assert_eq!(answer_message(&answer).contains("\"type\":\"bilibiliAnswer\""), true);
    }

    #[test]
    fn says_whether_its_signed_in_and_playing() {
        assert_eq!(
            state_message(Some(&State { signed_in: true, playing: false, vip: Some("VIP".into()) }), false),
            r#"{"playing":false,"signedIn":true,"signingIn":false,"type":"bilibili","vip":"VIP"}"#
        );
        assert_eq!(
            state_message(None, true),
            r#"{"playing":null,"signedIn":null,"signingIn":true,"type":"bilibili","vip":null}"#
        );
    }
}
