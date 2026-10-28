//! QQ Music (y.qq.com), run hidden under the cab: its own page, its own login (a QR code in a window on the PC),
//! and its own API, read from the page (`qq.js`). The app's items, answers and playback are the shapes the NetEase
//! Cloud Music service uses (`netease.rs`): the cabin's music app shows either service, switched in the app.
//!
//! TODO(verify): QQ Music's own API (`u.y.qq.com/cgi-bin/musicu.fcg`, its search sign; `c.y.qq.com` for a
//! playlist, lyrics and the account's lists) as the page asks it, and its cookie names (`uin`, `qm_keyst`): the
//! page fetch needs CORS off for this profile (`webview.rs`'s `new_with_arguments`), and playback needs the
//! login's vkey (a player's PC, 2026-10-28: search works signed out; the vkey answer is empty without a login).

use std::cell::RefCell;
use std::path::Path;

use crate::netease::{Answer, Playback, Question, Repeat, State};
use crate::signin::{self, Confirming, Progress, SignInWindow};
use crate::webview::{self, OffscreenWebView, Stage};

/// QQ Music's page (its own web player; the account's own sign-in is a dialog of this page).
pub const HOME: &str = "https://y.qq.com/";

/// The CORS-free environment its page needs to read `u.y.qq.com`'s answers: this profile's browser only (the
/// other services have their own).
const CORS_OFF: &str = "--disable-web-security";

/// What the cabin app asks of QQ Music (`qq` in ui/src/shared/host.ts; the same actions as `netease`'s).
#[derive(Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "action", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Command {
    /// Run (hidden), saying whether it's signed in: the QQ Music app is open.
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

/// What QQ Music's page says (`qq.js`).
#[derive(Debug, PartialEq)]
enum Message {
    /// The page loaded (anew): the questions it missed are asked again.
    Ready,
    State(State),
    Answer(Box<Answer>),
    Playback(Option<Box<Playback>>),
}

/// What the host takes from QQ Music for the cabin page and the log.
#[derive(Debug, PartialEq)]
pub enum Report {
    /// The sign-in window opened (`true`) or closed.
    SignInWindow(bool),
    /// The window closed signed in, and its page is yet to say it's signed in (`true`), or it has (or took too
    /// long: `false`).
    Confirming(bool),
    State(State),
    Answer(Box<Answer>),
    Playback(Option<Box<Playback>>),
}

pub struct Qq {
    view: OffscreenWebView,
    sign_in: RefCell<Option<SignInWindow>>,
    confirming: Confirming,
    pending: RefCell<Vec<Report>>,
    /// The app's questions not answered yet: asked again as the page is ready anew.
    unanswered: RefCell<Vec<(u32, String)>>,
}

impl Qq {
    /// Starts it, hidden, on this service's own profile (`user_data`), and asks its page.
    pub fn start(stage: &Stage, width: u32, height: u32, user_data: &Path) -> Result<Self, webview::Error> {
        let view = OffscreenWebView::new_with_arguments(stage, width, height, user_data, CORS_OFF)?;
        view.log_as("qq")?;
        view.show(false)?;
        stage.add(&view, false)?;
        view.add_startup_script(include_str!("qq.js"))?;
        view.navigate(HOME)?;
        Ok(Self {
            view,
            sign_in: RefCell::new(None),
            confirming: Confirming::default(),
            pending: RefCell::new(Vec::new()),
            unanswered: RefCell::new(Vec::new()),
        })
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
                    // Not a question for QQ Music: failed at once, so the app isn't left waiting.
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

    /// Its sign-in window, opened (or brought forward if it is): QQ Music's own login page, a QR code to scan.
    fn open_sign_in(&self) {
        let mut sign_in = self.sign_in.borrow_mut();
        if let Some(window) = sign_in.as_ref() {
            window.bring_forward();
            return;
        }
        match SignInWindow::open(self.view.environment(), &signin::QQMUSIC) {
            Ok(window) => {
                *sign_in = Some(window);
                self.pending.borrow_mut().push(Report::SignInWindow(true));
            }
            // Not opened: the page's own sign-in may still work when it's clicked.
            Err(_) => {}
        }
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
            match read_message(&message) {
                Some(Message::Ready) => {
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
    if let Some(answer) = value.get("answer") {
        // `qq.js`'s own shape: the payload under `answer`, its id with it.
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

/// `{"type":"qq","signedIn":true,"playing":false,"signingIn":false,"vip":…}` for the cabin page (`null` fields
/// when QQ Music isn't running).
pub fn state_message(state: Option<&State>, signing_in: bool) -> String {
    serde_json::json!({
        "type": "qq",
        "signedIn": state.map(|s| s.signed_in),
        "playing": state.map(|s| s.playing),
        "vip": state.and_then(|s| s.vip.as_deref()),
        "signingIn": signing_in,
    })
    .to_string()
}

/// `{"type":"qqAnswer","id":…,…}`: QQ Music's answer to the app's question.
pub fn answer_message(answer: &Answer) -> String {
    let mut message = serde_json::to_value(answer).unwrap_or_default();
    message["type"] = "qqAnswer".into();
    message.to_string()
}

/// `{"type":"qqPlayback","playback":{…}}` (`null`: nothing plays).
pub fn playback_message(playback: Option<&Playback>) -> String {
    serde_json::json!({ "type": "qqPlayback", "playback": playback }).to_string()
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
    fn reads_qq_musics_page() {
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
        assert_eq!(answer_message(&answer).contains("\"type\":\"qqAnswer\""), true);
    }

    #[test]
    fn says_whether_its_signed_in_and_playing() {
        assert_eq!(
            state_message(Some(&State { signed_in: true, playing: false, vip: Some("VIP".into()) }), false),
            r#"{"playing":false,"signedIn":true,"signingIn":false,"type":"qq","vip":"VIP"}"#
        );
        assert_eq!(
            state_message(None, true),
            r#"{"playing":null,"signedIn":null,"signingIn":true,"type":"qq","vip":null}"#
        );
    }
}
