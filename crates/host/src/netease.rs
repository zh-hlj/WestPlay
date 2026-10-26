//! 未编译验证（本机无 Rust 工具链）：接线后请先跑 `cargo check -p westplay-host`。本文件按 v2.0.3 的
//! spotify.rs / youtube_music.rs 的形状书写，选择器与接口未在真机上核对（见 netease.js 的 TODO(verify)）。
//!
//! NetEase Cloud Music: its own web player (music.163.com), in a WebView of its own, hidden under the cabin
//! page. The NetEase Cloud Music app the player sees is WestPlay's own; the web player plays and answers the
//! app's questions, from its own page: a script in it (`netease.js`) reads the player bar and the page's own
//! media session, plays through the page's own buttons and player, and asks NetEase's own API with the page's
//! own session, as the page itself does.
//!
//! Signing in is NetEase's own page, in a window on the PC's desktop (`signin.rs`), on this WebView's profile
//! (one of its own: signing out forgets NetEase's cookies alone). Nothing of the account passes through
//! WestPlay: the page's session stays in the page; what comes out is what the app shows (names, covers, what
//! plays), only the fields below (anything else the page might say is dropped here), and whether it's signed
//! in. Nothing of it is kept or logged.
//!
//! The page comes in two versions (docs/netease/README.md): the old web player (music.163.com, its player bar
//! in the top frame and its content in `#g_iframe`) and the new full-featured web player NetEase put out in
//! November 2025, whose page shares neither its DOM nor its addresses. `netease.js` is written for the old one
//! and says which of the two it is in (`netease.js`'s `TODO(verify)`); the new one is a milestone of its own.
//!
//! Its sound comes from the truck's own speakers, as the others' do (`cab_sound.js`, told the truck's speakers,
//! the driver's head and the camera). NetEase's web player plays unprotected sound in a plain media element:
//! nothing DRM needs to pass, but VIP songs, songs with no rights here and songs out of the account's region
//! play only what NetEase itself plays of them (a sample, or nothing): nothing of that is got around here.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::Path;

use crate::signin::{self, Confirming, Progress, SignInWindow};
use crate::speakers::{self, Equalizer, Head, Speaker};
use crate::webview::{self, OffscreenWebView, Stage};

/// NetEase Cloud Music's web player.
// TODO(verify): the old web player's address; the new one (2025-11) is entered from
// `https://music.163.com/#/download` → "Linux" and may be another host (README §3). `netease.js` only runs on
// `music.163.com`.
pub const HOME: &str = "https://music.163.com/";

/// What the cabin page asks of NetEase Cloud Music (`netease` in ui/src/shared/host.ts).
#[derive(Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "action", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Command {
    /// Run (hidden), saying whether it's signed in: the NetEase Cloud Music app is open.
    Start,
    /// NetEase's sign-in, in a window on the desktop (a QR code to scan, as its page has it).
    SignIn,
    /// Forget the sign-in, and start again signed out.
    SignOut,
    /// A question for NetEase Cloud Music, answered with the same `id`.
    Ask {
        id: u32,
        question: Question,
    },
    /// Play a song (`song`), from a playlist (`playlist`), as NetEase's own page plays them; without either,
    /// play on.
    Play {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        song: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        playlist: Option<String>,
    },
    Pause,
    /// Play on, from where it was paused.
    Resume,
    Next,
    Previous,
    Seek {
        seconds: f64,
    },
    /// The page player's volume, 0 to 100.
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

impl Command {
    /// For NetEase's page (all but the host's own: running, and signing in and out), and only what's sound:
    /// ids of the shape NetEase's have, times and volumes that are numbers.
    fn for_page(&self) -> bool {
        match self {
            Command::Start | Command::SignIn | Command::SignOut => false,
            Command::Play { song, playlist } => {
                song.as_deref().is_none_or(is_id) && playlist.as_deref().is_none_or(is_id)
            }
            Command::Seek { seconds } => seconds.is_finite(),
            Command::Volume { percent } => percent.is_finite(),
            _ => true,
        }
    }
}

/// What the NetEase Cloud Music app asks.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "ask", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Question {
    /// Home: NetEase Cloud Music's own recommendation shelves.
    Home,
    /// A search: its songs, playlists, albums and artists.
    Search {
        query: String,
    },
    /// A song's words (`song`: its id).
    Lyrics {
        song: String,
    },
    /// A playlist's or an album's page (`id`), and its songs.
    // TODO(verify): a NetEase id doesn't say which of the two it is; `netease.js` tries a playlist's page first
    // and an album's then (README §6.2).
    Collection {
        id: String,
    },
}

impl Question {
    /// Whether it's a question for NetEase's page: ids of the shape NetEase's have, and a search that is one.
    fn is_sound(&self) -> bool {
        match self {
            Question::Home => true,
            Question::Search { query } => (1..=200).contains(&query.chars().count()),
            Question::Lyrics { song } => is_id(song),
            Question::Collection { id } => is_id(id),
        }
    }
}

/// NetEase's id for something (a song's, a playlist's, an album's, an artist's): its number in decimal, as its
/// pages and its own API give them. No sign, no spaces, nothing else.
fn is_id(id: &str) -> bool {
    (1..=20).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_digit()) && id.bytes().any(|b| b != b'0')
}

#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Repeat {
    Off,
    All,
    One,
}

#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Song,
    Playlist,
    Album,
    Artist,
    /// A radio (a song's station, of songs alike): in the app's type, not the page's answers yet.
    Radio,
}

/// A cover's address: only an `https` one passes (NetEase's CDN serves both; the cabin page is `https` and
/// would block a plain one). Nothing else of the page's rows.
// TODO(verify): that every cover NetEase's page gives has an `https` form (`netease.js` upgrades `http://`).
fn is_image(url: &str) -> bool {
    url.len() <= 500 && url.strip_prefix("https://").is_some_and(|rest| !rest.is_empty())
}

fn image(image: Option<String>) -> Option<String> {
    image.filter(|url| is_image(url))
}

/// A card or a row: what it is, its name, who it's by, its cover, and a line about it.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub kind: Kind,
    pub name: String,
    #[serde(default)]
    pub by: String,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

impl Item {
    /// Only what the app shows, and only a row that names something.
    fn checked(mut self) -> Option<Self> {
        if !is_id(&self.id) || self.name.is_empty() {
            return None;
        }
        self.name = cut(&self.name, 200);
        self.by = cut(&self.by, 200);
        self.description = self.description.filter(|line| !line.is_empty()).map(|line| cut(&line, 400));
        self.image = image(self.image);
        Some(self)
    }
}

/// A song: its id, its name, its artists and album, its cover, and its length (milliseconds, as NetEase's own
/// API gives it).
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub artists: Vec<String>,
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub duration_ms: f64,
    /// In the account's own lists (Liked Songs, a saved playlist), as the page's API says.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saved: Option<bool>,
}

impl Track {
    /// Only what the app shows, and only a song whose id is one.
    fn checked(mut self) -> Option<Self> {
        if !is_id(&self.id) || self.name.is_empty() {
            return None;
        }
        self.name = cut(&self.name, 200);
        self.artists.truncate(10);
        self.artists = self.artists.iter().map(|artist| cut(artist, 100)).collect();
        self.album = cut(&self.album, 200);
        self.image = image(self.image);
        if !self.duration_ms.is_finite() || !(0.0..=86_400_000.0).contains(&self.duration_ms) {
            self.duration_ms = 0.0;
        }
        Some(self)
    }
}

fn tracks(list: Vec<Track>) -> Vec<Track> {
    list.into_iter().filter_map(Track::checked).collect()
}

fn items(list: Vec<Item>) -> Vec<Item> {
    list.into_iter().filter_map(Item::checked).collect()
}

/// A shelf of Home: its title, and its rows.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Section {
    pub title: String,
    #[serde(default)]
    pub items: Vec<Item>,
}

impl Section {
    fn checked(mut self) -> Option<Self> {
        self.title = cut(&self.title, 100);
        self.items = items(self.items);
        (!self.title.is_empty() && !self.items.is_empty()).then_some(self)
    }
}

/// Home: NetEase Cloud Music's own shelves.
#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Home {
    #[serde(default)]
    pub sections: Vec<Section>,
}

impl Home {
    fn checked(mut self) -> Self {
        self.sections = self.sections.into_iter().filter_map(Section::checked).take(20).collect();
        self
    }
}

/// A search's results.
#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Results {
    #[serde(default)]
    pub songs: Vec<Track>,
    #[serde(default)]
    pub playlists: Vec<Item>,
    #[serde(default)]
    pub albums: Vec<Item>,
    #[serde(default)]
    pub artists: Vec<Item>,
}

impl Results {
    fn checked(mut self) -> Self {
        self.songs = tracks(self.songs);
        self.playlists = items(self.playlists);
        self.albums = items(self.albums);
        self.artists = items(self.artists);
        self
    }
}

/// A playlist's or an album's page: what it is, and its songs.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Collection {
    pub item: Item,
    #[serde(default)]
    pub tracks: Vec<Track>,
}

impl Collection {
    fn checked(mut self) -> Option<Self> {
        self.item = self.item.checked()?;
        self.tracks = tracks(self.tracks);
        Some(self)
    }
}

/// Where a song plays from: a playlist's or an album's id, its name if the page said one, and what it is.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Context {
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub kind: Kind,
}

impl Context {
    fn checked(mut self) -> Option<Self> {
        is_id(&self.id).then(|| {
            self.name = cut(&self.name, 200);
            self
        })
    }
}

/// What NetEase's page plays: the song, where from, how far in (milliseconds, as the page's player has it), the
/// options, the volume, and the songs to come.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playback {
    #[serde(default)]
    pub track: Option<Track>,
    #[serde(default)]
    pub context: Option<Context>,
    pub playing: bool,
    #[serde(default)]
    pub position_ms: f64,
    #[serde(default)]
    pub duration_ms: f64,
    #[serde(default)]
    pub shuffle: bool,
    pub repeat: Repeat,
    /// The page player's volume, 0 to 1 (`None`: none it can set).
    #[serde(default)]
    pub volume: Option<f64>,
    // TODO(verify): the songs to come, from the page's own queue; `netease.js` says none for now (README §6.3).
    #[serde(default)]
    pub next: Vec<Track>,
}

impl Playback {
    fn checked(mut self) -> Option<Self> {
        self.track = self.track.and_then(Track::checked);
        self.context = self.context.and_then(Context::checked);
        let time = |ms: f64| if ms.is_finite() && (0.0..=86_400_000.0).contains(&ms) { ms } else { 0.0 };
        self.position_ms = time(self.position_ms);
        self.duration_ms = time(self.duration_ms);
        // A position past the song's end (a page that changed songs): nothing of it to show.
        if self.duration_ms > 0.0 {
            self.position_ms = self.position_ms.min(self.duration_ms);
        }
        self.volume = self.volume.filter(|volume| volume.is_finite()).map(|volume| volume.clamp(0.0, 1.0));
        self.next = tracks(self.next);
        Some(self)
    }
}

/// Whether the page is signed in, and playing.
#[derive(Clone, Debug, PartialEq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub signed_in: bool,
    pub playing: bool,
}

/// NetEase's answer to the app's question `answer` (its id), under the question's name; `failed` when NetEase
/// didn't answer.
#[derive(Debug, Default, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Answer {
    #[serde(rename(serialize = "id"))]
    pub answer: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub home: Option<Home>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub search: Option<Results>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collection: Option<Collection>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lyrics: Option<crate::lyrics::Lyrics>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub failed: bool,
}

impl Answer {
    fn checked(mut self) -> Self {
        self.home = self.home.map(Home::checked);
        self.search = self.search.map(Results::checked);
        self.collection = self.collection.and_then(Collection::checked);
        self.lyrics = self.lyrics.map(crate::lyrics::Lyrics::checked);
        self
    }
}

/// The most of a title, a line or a name taken from the page (the app shows less of them).
fn cut(text: &str, most: usize) -> String {
    text.chars().take(most).collect()
}

#[derive(Debug, PartialEq)]
pub enum Report {
    /// The music's spectrum, while the cab's Equalizer asks for it ([`speakers::read_spectrum`]).
    Spectrum(Vec<u8>),
    State(State),
    /// The sign-in window opened (`true`) or closed.
    SignInWindow(bool),
    /// The sign-in window closed signed in, and NetEase's page is yet to say it's signed in (`true`), or it has
    /// (or took too long: `false`).
    Confirming(bool),
    Answer(Box<Answer>),
    /// What plays (`None`: nothing).
    Playback(Option<Box<Playback>>),
}

pub struct Netease {
    view: OffscreenWebView,
    sign_in: RefCell<Option<SignInWindow>>,
    /// Once it closed signed in, until the page says it's signed in.
    confirming: Confirming,
    pending: RefCell<Vec<Report>>,
    /// The app's questions not answered yet: asked again as the page is ready anew (a page that loads again,
    /// signed in or out, misses what was sent while it loaded).
    unanswered: RefCell<Unanswered>,
    /// What the page was told of the cab, sent again when it loads anew.
    told: RefCell<Told>,
}

/// What the host tells NetEase's page of the cab (never the cabin page's to send): the truck's speakers (`None`:
/// as it is, a truck whose speakers aren't known), the driver's head, and the camera outside (its distance,
/// metres; 0: not known). As Spotify's (spotify.rs).
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

/// Questions asked of the page, by id, until answered (the latest `MOST`: the app gives up on older ones).
#[derive(Debug, Default)]
struct Unanswered(BTreeMap<u32, String>);

impl Unanswered {
    const MOST: usize = 32;

    fn asked(&mut self, id: u32, sent: String) {
        self.0.insert(id, sent);
        while self.0.len() > Self::MOST {
            self.0.pop_first();
        }
    }

    fn answered(&mut self, id: u32) {
        self.0.remove(&id);
    }

    /// What to ask again, oldest first.
    fn all(&self) -> Vec<String> {
        self.0.values().cloned().collect()
    }
}

impl Netease {
    /// Its WebView (performance.rs counts its processes).
    pub fn view(&self) -> &OffscreenWebView {
        &self.view
    }

    /// Opens NetEase Cloud Music's web player in a WebView of `stage`'s frame (`width` x `height`), hidden
    /// under the cabin page, on `user_data`'s profile (one of its own: signing out forgets NetEase's cookies
    /// alone).
    // TODO(verify): a profile of its own against the cabin page's (README §2.4): own keeps the account apart.
    pub fn start(stage: &Stage, width: u32, height: u32, user_data: &Path) -> Result<Self, webview::Error> {
        let view = OffscreenWebView::new(stage, width, height, user_data)?;
        view.log_as("netease")?;
        view.show(false)?;
        stage.add(&view, false)?;
        // The truck speakers' sound first: the page's script makes its own of it.
        view.add_startup_script(concat!(include_str!("cab_sound.js"), "\n", include_str!("netease.js")))?;
        view.navigate(HOME)?;
        Ok(Self {
            view,
            sign_in: RefCell::new(None),
            confirming: Confirming::default(),
            pending: RefCell::new(Vec::new()),
            unanswered: RefCell::default(),
            told: RefCell::default(),
        })
    }

    pub fn command(&self, command: &Command) -> windows::core::Result<()> {
        match command {
            Command::Start => Ok(()),
            Command::SignIn => {
                self.open_sign_in();
                Ok(())
            }
            Command::SignOut => {
                self.view.delete_cookies()?;
                self.view.navigate(HOME)
            }
            Command::Ask { id, question } => {
                if !question.is_sound() {
                    // Not a question for NetEase: failed at once, so the app isn't left waiting.
                    let answer = Answer { answer: *id, failed: true, ..Default::default() };
                    self.pending.borrow_mut().push(Report::Answer(Box::new(answer)));
                    return Ok(());
                }
                let sent = serde_json::to_string(command).unwrap_or_default();
                self.unanswered.borrow_mut().asked(*id, sent.clone());
                self.view.post_json(&sent)
            }
            _ if command.for_page() => self.view.post_json(&serde_json::to_string(command).unwrap_or_default()),
            _ => Ok(()),
        }
    }

    /// NetEase's sign-in window, opened (or brought forward if it is): its page's own sign-in, a QR code to
    /// scan with the phone's app, on this WebView's profile.
    fn open_sign_in(&self) {
        let mut sign_in = self.sign_in.borrow_mut();
        if let Some(window) = sign_in.as_ref() {
            window.bring_forward();
            return;
        }
        match SignInWindow::open(self.view.environment(), &signin::NETEASE) {
            Ok(window) => {
                *sign_in = Some(window);
                self.pending.borrow_mut().push(Report::SignInWindow(true));
            }
            Err(e) => crate::startup::mark(&format!("host: the NetEase Cloud Music sign-in window couldn't open: {e}")),
        }
    }

    /// The truck (its SDK model id), the driver's head, and whether the camera is outside the cab and how far
    /// (metres; 0: not known): the page is told the truck's speakers as the truck changes, the head as it moves,
    /// the camera as it goes in or out or a quarter metre further, the tone as it's set and the spectrum as it's
    /// wanted (as Spotify's: spotify.rs).
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

    /// What NetEase's page said since the last call, and the sign-in window opening or closing (signed in, the
    /// web player loads again, signed in).
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
                Some(Message::SignIn) => self.open_sign_in(),
                // A page loaded anew: the cab as it is, and the questions it missed.
                Some(Message::Ready) => {
                    for told in self.told.borrow().messages.iter().flatten() {
                        let _ = self.view.post_json(told);
                    }
                    for sent in self.unanswered.borrow().all() {
                        let _ = self.view.post_json(&sent);
                    }
                }
                Some(Message::Speakers(said)) => log!("[netease] speakers: {said}"),
                Some(Message::State(state)) => reports.push(Report::State(state)),
                Some(Message::Answer(answer)) => {
                    self.unanswered.borrow_mut().answered(answer.answer);
                    reports.push(Report::Answer(answer));
                }
                Some(Message::Playback(playback)) => reports.push(Report::Playback(playback)),
                None => {}
            }
        }
        reports.extend(self.pending.borrow_mut().drain(..));
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

/// A message of NetEase's page (`netease.js`).
#[derive(Debug, PartialEq)]
enum Message {
    /// The page's own sign-in asked for: a QR code to scan, in a window on the desktop.
    SignIn,
    /// The page loaded (anew): it's told the cab again, and the questions it missed.
    Ready,
    /// What the truck's speakers made of its sound, for the log: through them, no element found, or silent
    /// while NetEase plays.
    Speakers(String),
    State(State),
    Answer(Box<Answer>),
    Playback(Option<Box<Playback>>),
}

fn read_message(message: &str) -> Option<Message> {
    let value: serde_json::Value = serde_json::from_str(message).ok()?;
    if value.get("signIn").and_then(serde_json::Value::as_bool) == Some(true) {
        return Some(Message::SignIn);
    }
    if value.get("ready").and_then(serde_json::Value::as_bool) == Some(true) {
        return Some(Message::Ready);
    }
    if let Some(said) = value.get("speakers").and_then(serde_json::Value::as_str) {
        // Only the page's own two sayings, and short: nothing else of the page reaches the log.
        // TODO(verify): the exact sayings `netease.js` posts (`tellCab`), as Spotify's are.
        let known = said == "no media element found"
            || said.starts_with("through the speakers (")
            || said.starts_with("silent while playing (");
        return (known && said.len() <= 60).then(|| Message::Speakers(said.to_owned()));
    }
    if let Some(answer) = value.get("answer") {
        // Two shapes are read: the payload under `answer`, its id with it (`netease.js`'s own:
        // `{"answer":{"id":3,"home":…}}`), and the id under `answer` with the payload beside it (Spotify's and
        // YouTube Music's: `{"answer":3,"home":…}`).
        let (id, payload) = if let Some(id) = answer.as_u64() {
            (id, &value)
        } else {
            (answer.get("id").and_then(serde_json::Value::as_u64)?, answer)
        };
        return Some(Message::Answer(Box::new(read_answer(u32::try_from(id).ok()?, payload))));
    }
    if let Some(playback) = value.get("playback") {
        if playback.is_null() {
            return Some(Message::Playback(None));
        }
        return serde_json::from_value::<Playback>(playback.clone())
            .ok()
            .and_then(Playback::checked)
            .map(|playback| Message::Playback(Some(Box::new(playback))));
    }
    // TODO(verify): the page's own state/answer shape, as `netease.js` posts it (`{state:{…}}`, `{answer:{id,…}}`,
    // README §6.3); the flat shapes (Spotify's and YouTube Music's) are read too, so either side may change.
    // The state: under `state` (the page's own: `{"state":{"signedIn":…,"playing":…}}`), or beside it
    // (Spotify's and YouTube Music's: `{"signedIn":…,"playing":…}`).
    let state = value.get("state").cloned().unwrap_or(value);
    serde_json::from_value::<State>(state).ok().map(Message::State)
}

/// The answer in `payload` (NetEase's page's own shape, or Spotify's and YouTube Music's), `id` its question's;
/// failed when it doesn't read (NetEase's changed what it says), so the app isn't left waiting.
fn read_answer(id: u32, payload: &serde_json::Value) -> Answer {
    let mut fields = payload.clone();
    if let Some(object) = fields.as_object_mut() {
        object.insert("answer".into(), serde_json::Value::from(id));
    }
    serde_json::from_value::<Answer>(fields)
        .map(Answer::checked)
        .unwrap_or_else(|_| Answer { answer: id, failed: true, ..Default::default() })
}

/// `{"type":"netease","signedIn":true,"playing":false,"signingIn":false}` for the cabin page (`null` fields when
/// NetEase Cloud Music isn't running).
pub fn state_message(state: Option<&State>, signing_in: bool) -> String {
    serde_json::json!({
        "type": "netease",
        "signedIn": state.map(|s| s.signed_in),
        "playing": state.map(|s| s.playing),
        "signingIn": signing_in,
    })
    .to_string()
}

/// `{"type":"neteaseAnswer","id":…,"home":{…}}`: NetEase's answer to the app's question.
pub fn answer_message(answer: &Answer) -> String {
    let mut message = serde_json::to_value(answer).unwrap_or_default();
    message["type"] = "neteaseAnswer".into();
    message.to_string()
}

/// `{"type":"neteasePlayback","playback":{…}}` (`null`: nothing plays).
pub fn playback_message(playback: Option<&Playback>) -> String {
    serde_json::json!({ "type": "neteasePlayback", "playback": playback }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_cabin_pages_commands() {
        let ask: Command =
            serde_json::from_str(r#"{"action":"ask","id":3,"question":{"ask":"search","query":"tarkan"}}"#).unwrap();
        assert_eq!(ask, Command::Ask { id: 3, question: Question::Search { query: "tarkan".into() } });
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"ask","id":4,"question":{"ask":"home"}}"#).unwrap(),
            Command::Ask { id: 4, question: Question::Home }
        );
        assert_eq!(
            serde_json::from_str::<Command>(
                r#"{"action":"ask","id":5,"question":{"ask":"lyrics","song":"185809"}}"#
            )
            .unwrap(),
            Command::Ask { id: 5, question: Question::Lyrics { song: "185809".into() } }
        );
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"ask","id":6,"question":{"ask":"collection","id":"3778678"}}"#)
                .unwrap(),
            Command::Ask { id: 6, question: Question::Collection { id: "3778678".into() } }
        );
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"play","song":"185809","playlist":"3778678"}"#).unwrap(),
            Command::Play { song: Some("185809".into()), playlist: Some("3778678".into()) }
        );
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"play"}"#).unwrap(),
            Command::Play { song: None, playlist: None }
        );
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"repeat","mode":"one"}"#).unwrap(),
            Command::Repeat { mode: Repeat::One }
        );
        assert_eq!(
            serde_json::from_str::<Command>(r#"{"action":"volume","percent":40}"#).unwrap(),
            Command::Volume { percent: 40.0 }
        );
        assert_eq!(serde_json::from_str::<Command>(r#"{"action":"seek","seconds":42.5}"#).unwrap(), Command::Seek {
            seconds: 42.5
        });
        assert_eq!(serde_json::from_str::<Command>(r#"{"action":"start"}"#).unwrap(), Command::Start);
        assert_eq!(serde_json::from_str::<Command>(r#"{"action":"signIn"}"#).unwrap(), Command::SignIn);
        assert_eq!(serde_json::from_str::<Command>(r#"{"action":"resume"}"#).unwrap(), Command::Resume);
        assert!(serde_json::from_str::<Command>(r#"{"action":"explode"}"#).is_err());
    }

    #[test]
    fn passes_the_page_its_commands_as_the_app_sent_them() {
        // NetEase's ids: their numbers in decimal, and nothing else.
        assert!(is_id("185809") && is_id("3778678") && is_id("140737488355328"));
        assert!(!is_id("") && !is_id("000") && !is_id("12/../x") && !is_id("-1") && !is_id("abc"));
        assert!(!is_id(&"9".repeat(21)));
        let ask = Command::Ask { id: 9, question: Question::Search { query: "tarkan".into() } };
        assert_eq!(
            serde_json::to_string(&ask).unwrap(),
            r#"{"action":"ask","id":9,"question":{"ask":"search","query":"tarkan"}}"#
        );
        assert_eq!(
            serde_json::to_string(&Command::Ask { id: 1, question: Question::Home }).unwrap(),
            r#"{"action":"ask","id":1,"question":{"ask":"home"}}"#
        );
        assert_eq!(
            serde_json::to_string(&Command::Play { song: None, playlist: None }).unwrap(),
            r#"{"action":"play"}"#
        );
        assert_eq!(
            serde_json::to_string(&Command::Repeat { mode: Repeat::Off }).unwrap(),
            r#"{"action":"repeat","mode":"off"}"#
        );
        // The host's own never reach the page; nor does anything of a shape NetEase wouldn't know.
        assert!(ask.for_page() && !Command::SignOut.for_page() && !Command::Start.for_page());
        assert!(!Command::Play { song: Some("12/../x".into()), playlist: None }.for_page());
        assert!(!Command::Play { song: None, playlist: Some("x".into()) }.for_page());
        assert!(!Command::Seek { seconds: f64::NAN }.for_page());
        assert!(!Command::Volume { percent: f64::INFINITY }.for_page());
    }

    #[test]
    fn reads_neteases_page() {
        assert_eq!(read_message(r#"{"signIn":true}"#), Some(Message::SignIn));
        assert_eq!(read_message(r#"{"ready":true}"#), Some(Message::Ready));
        // The page's state, in the shape `netease.js` posts it, and in the shape the other players post.
        assert_eq!(
            read_message(r#"{"state":{"signedIn":true,"playing":false}}"#),
            Some(Message::State(State { signed_in: true, playing: false }))
        );
        assert_eq!(
            read_message(r#"{"signedIn":false,"playing":true}"#),
            Some(Message::State(State { signed_in: false, playing: true }))
        );
        assert_eq!(read_message(r#"{"playback":null}"#), Some(Message::Playback(None)));
        assert_eq!(
            read_message(r#"{"speakers":"through the speakers (audio)"}"#),
            Some(Message::Speakers("through the speakers (audio)".into()))
        );
        assert_eq!(
            read_message(r#"{"speakers":"silent while playing (2 elements, taken one paused)"}"#),
            Some(Message::Speakers("silent while playing (2 elements, taken one paused)".into()))
        );
        assert_eq!(read_message(r#"{"speakers":"anything else"}"#), None);
        assert_eq!(read_message("not json"), None);
        assert_eq!(read_message(r#"{"something":1}"#), None);
    }

    #[test]
    fn reads_answers_in_both_shapes() {
        // `netease.js`'s own: the payload under `answer`, its id with it.
        let page = r#"{"answer":{"id":4,"home":{"sections":[{"title":"推荐歌单","items":[{"id":"3778678","kind":"playlist",
            "name":"欧美私人订制","by":"","image":"https://p1.music.126.net/x.jpg"}]}]}}}"#;
        let Some(Message::Answer(answer)) = read_message(page) else { panic!("not an answer") };
        assert_eq!(answer.answer, 4);
        assert_eq!(answer.home.as_ref().map(|home| home.sections.len()), Some(1));
        // Spotify's and YouTube Music's: the id under `answer`, the payload beside it.
        let Some(Message::Answer(answer)) = read_message(r#"{"answer":5,"search":{"songs":[]}}"#) else {
            panic!("not an answer")
        };
        assert_eq!(answer.answer, 5);
        assert!(answer.search.is_some());
    }

    #[test]
    fn says_when_an_answer_doesnt_read() {
        // NetEase changed what its page says: failed, with the question's id, so the app isn't left waiting.
        let Some(Message::Answer(answer)) =
            read_message(r#"{"answer":{"id":5,"home":{"sections":"not a list"}}}"#)
        else {
            panic!("not an answer")
        };
        assert_eq!(answer_message(&answer), r#"{"failed":true,"id":5,"type":"neteaseAnswer"}"#);
        let Some(Message::Answer(answer)) = read_message(r#"{"answer":6,"home":{"sections":"not a list"}}"#) else {
            panic!("not an answer")
        };
        assert_eq!(answer.answer, 6);
        assert!(answer.failed);
        assert_eq!(answer_message(&answer), r#"{"failed":true,"id":6,"type":"neteaseAnswer"}"#);
    }

    /// Only the fields the app shows pass: whatever else the page says (here, a song's fee and its play count)
    /// is dropped here.
    #[test]
    fn passes_on_only_what_the_app_shows() {
        let page = r#"{"answer":{"id":7,"collection":{"item":{"id":"3778678","kind":"playlist","name":"欧美私人订制",
            "by":"","image":"http://p1.music.126.net/cover.jpg","description":"","playCount":123456,"creator":{"nickname":"someone"}},
            "tracks":[{"id":"185809","name":"Şımarık","artists":["Tarkan"],"album":"Ölürüm Sana","image":"https://p2.music.126.net/x.jpg",
            "durationMs":240500,"fee":1,"saved":true,"privilege":{"st":0}}]}}}"#;
        let Some(Message::Answer(answer)) = read_message(page) else { panic!("not an answer") };
        let message = answer_message(&answer);
        assert!(message.contains(r#""type":"neteaseAnswer""#), "{message}");
        assert!(message.contains(r##""name":"Şımarık""##), "{message}");
        assert!(message.contains(r#""saved":true"#), "{message}");
        // A cover on an address the cabin page can't show (`http`): none; the page's other fields: dropped.
        assert!(!message.contains("playCount") && !message.contains("fee") && !message.contains("nickname"));
        let Some(collection) = answer.collection else { panic!("no collection") };
        assert!(collection.item.image.is_none(), "a plain http cover passed: {message}");
        assert_eq!(collection.tracks[0].image.as_deref(), Some("https://p2.music.126.net/x.jpg"));
    }

    #[test]
    fn passes_on_what_plays() {
        let page = r#"{"playback":{"track":{"id":"185809","name":"Şımarık","artists":["Tarkan"],"album":"Ölürüm Sana",
            "image":"https://p2.music.126.net/x.jpg","durationMs":240500},"context":{"id":"3778678","name":"欧美私人订制",
            "kind":"playlist"},"playing":true,"positionMs":12500,"durationMs":240500,"shuffle":false,"repeat":"all",
            "volume":0.5,"next":[],"fee":1,"privilege":{"st":0}}}"#;
        let Some(Message::Playback(Some(playback))) = read_message(page) else { panic!("not a playback") };
        assert_eq!(playback.repeat, Repeat::All);
        assert_eq!(playback.position_ms, 12_500.0);
        let message = playback_message(Some(&playback));
        assert!(message.contains(r#""type":"neteasePlayback""#), "{message}");
        assert!(message.contains(r#""name":"Şımarık""#), "{message}");
        assert!(message.contains(r#""positionMs":12500.0"#), "{message}");
        assert!(message.contains(r#""durationMs":240500.0"#), "{message}");
        assert!(!message.contains("fee") && !message.contains("privilege"), "extra fields passed: {message}");
        let nothing = playback_message(None);
        assert_eq!(nothing, r#"{"playback":null,"type":"neteasePlayback"}"#);
    }

    #[test]
    fn says_whether_its_signed_in_and_playing() {
        assert_eq!(
            state_message(Some(&State { signed_in: true, playing: false }), false),
            r#"{"playing":false,"signedIn":true,"signingIn":false,"type":"netease"}"#
        );
        assert_eq!(
            state_message(None, true),
            r#"{"playing":null,"signedIn":null,"signingIn":true,"type":"netease"}"#
        );
    }
}
