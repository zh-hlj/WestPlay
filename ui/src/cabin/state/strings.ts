import type { Sky } from '../../shared/host'
import type { ReturnKind } from '../keyboard/layouts'
import type { TurnKind } from '../maps/guidance'
import type { DestinationKind } from '../maps/places'
import type { AppId } from './apps'

/**
 * The cabin's own words, in English, Turkish and Simplified Chinese for now (every one of the game's 43
 * languages later): Turkish when the game plays in Turkish, Chinese when it plays in Chinese, English
 * otherwise. Place names on the map come from the game's own text in its language (crates/mapdata locale.rs),
 * not from here.
 */

export type Language = 'en' | 'tr' | 'zh'

export interface Strings {
  /** The decimal separator: "9.4 km", "9,4 km". */
  decimal: string
  /** The trip pill: "15:40 arrival · 12 min · 9.4 km". */
  arrival: string
  minutes: (minutes: number) => string
  hours: (hours: number, minutes: string) => string
  speedLimit: (limit: number) => string
  /** Turn-by-turn. */
  now: string
  then: string
  arrive: string
  turns: Record<Exclude<TurnKind, 'roundabout'>, string>
  roundabout: (exit: number) => string
  /** Maps. */
  recentre: string
  /** The compass: turns the map north up, seen from above. */
  northUp: string
  zoomIn: string
  zoomOut: string
  /** Maps' search: its button, and the field's hint. */
  search: string
  searchPlaces: string
  close: string
  /** Destinations (Maps' search): its sections, what places are (one, and the nearby lists'), the place
   * card's buttons, and how the game answered. */
  destinations: {
    favourites: string
    headquarters: string
    yourGarage: string
    findNearby: string
    /** "Find nearby" on a route: the places offered are along it. */
    alongRoute: string
    recents: string
    kinds: Record<DestinationKind, string>
    nearby: Partial<Record<DestinationKind, string>>
    straightLine: (distance: string) => string
    /** How far along the route a place is. */
    alongTheRoute: (distance: string) => string
    /** A stop added: how much longer the route is with it (the game's distance and time). */
    stopAdds: (distance: string, time: string) => string
    /** A stop added, but the game's new route doesn't pass it. */
    notOnRoute: string
    /** The routes offered before Go (Directions), by what each is planned for; while they're found. */
    plans: Record<'fastest' | 'shortest' | 'smallRoads' | 'other', string>
    finding: string
    /** Go: the route is set, but the game takes its own way there, not the one picked. */
    ownWay: string
    go: string
    addStop: string
    endRoute: string
    back: string
    noResults: string
    loading: string
    noPlaces: string
    done: Record<'go' | 'addStop' | 'end', string>
    alreadyThere: string
    full: string
    onJob: string
    noAnswer: string
    unsupported: string
    failed: string
  }
  /** The keyboard: its keys (named for screen readers where they show a symbol), and a field's clear button. */
  keyboard: {
    space: string
    returnKey: Record<ReturnKind, string>
    shift: string
    capsLock: string
    delete: string
    nextKeyboard: string
    hide: string
    clear: string
    /** Whether the player's own keyboard types into the field. */
    typingWithKeyboard: string
    pausedWhileDriving: string
    selectToType: string
  }
  /** Music. */
  nowPlaying: string
  sources: string
  previous: string
  play: string
  pause: string
  next: string
  shuffle: string
  repeat: string
  notPlaying: string
  openMusicApp: string
  nothingLoaded: string
  playing: string
  /** The Dashboard's destination widget: the job's pickup or delivery, or where the route ends. */
  delivery: string
  pickup: string
  destination: string
  mapPoint: string
  arriveBy: (time: string) => string
  late: string
  /** Days of the week, short, from Monday (the game's day 0). */
  days: readonly string[]
  /** The Dashboard's weather widget: the weather, and the weather it's turning to. */
  weather: Record<Sky, string>
  weatherTurning: Record<Sky, string>
  /** The YouTube app: the search field's hint, Home's sections and chips (each a search), what a list says
   * when it's empty or YouTube didn't answer, the live badge, and the player's words. */
  youtube: {
    search: string
    continueWatching: string
    recentSearches: string
    chips: readonly { label: string; query: string }[]
    start: string
    noResults: string
    failed: string
    tryAgain: string
    live: string
    upNext: string
    nowPlaying: string
    back: string
    volume: string
    forget: string
    fill: string
    clear: string
    fullScreen: string
    signIn: string
    signOut: string
    /** A search's results: all of them, or channels only. */
    all: string
    channels: string
    subscribe: string
    subscribed: string
    /** Playlists: a search's filter, the word under one found, and its page's button. */
    playlists: string
    playlist: string
    playAll: string
    /** The player's captions and quality, and their choices for none and YouTube's own. */
    captions: string
    off: string
    quality: string
    auto: string
    /** The player's gear: its settings, and in them the speed (and its 1×), the audio track (dubbed ones),
     * YouTube's Stable volume and Voice boost. */
    settings: string
    playbackSpeed: string
    normal: string
    audioTrack: string
    stableVolume: string
    voiceBoost: string
    home: string
    subscriptions: string
    /** While Google's sign-in window is open on the PC. */
    finishOnPc: string
    /** Double-tapping a side of the player: "10 seconds". */
    seconds: (seconds: number) => string
  }
  /** The Spotify app, in Spotify's own words: while its sign-in window is open on the PC; its tabs and the
   * search pill's hint; Home's filters; what things are ("Playlist • Spotify"); the pages' words; Now
   * Playing's; and the toasts of adding to Liked Songs or Your Library. */
  spotify: {
    finishOnPc: string
    whatToPlay: string
    home: string
    library: string
    browse: string
    back: string
    filters: { all: string; music: string; podcasts: string }
    showAll: string
    browseAll: string
    recentSearches: string
    clearRecent: string
    forget: string
    noResults: (query: string) => string
    noResultsHint: string
    topResult: string
    songs: string
    artists: string
    playlists: string
    albums: string
    podcasts: string
    kinds: { playlist: string; album: string; artist: string; show: string; liked: string; song: string }
    songCount: (count: number) => string
    /** A playlist's length: "2 hr 45 min", "38 min 12 sec". */
    length: (seconds: number) => string
    recents: string
    gridView: string
    listView: string
    verified: string
    follow: string
    following: string
    monthlyListeners: (count: string) => string
    popular: string
    discography: string
    playingFrom: { playlist: string; album: string; artist: string; show: string; liked: string }
    nowPlaying: string
    queue: string
    nextFrom: (name: string) => string
    nextUp: string
    /** Now Playing's words for the song (Spotify's Lyrics): none, not timed yet, and where they're from. */
    lyrics: string
    noLyrics: string
    notSynced: string
    lyricsFrom: (provider: string) => string
    /** Now Playing's volume. */
    volume: string
    mute: string
    unmute: string
    /** Spotify didn't play what was asked for. */
    cantPlay: string
    /** Spotify didn't answer. */
    failed: string
    tryAgain: string
    next: string
    previous: string
    shuffle: string
    repeat: string
    close: string
    more: string
    download: string
    addToLiked: string
    addToLibrary: string
    added: string
    removed: string
    addedToLibrary: string
    removedFromLibrary: string
    /** Signing in (Spotify's "Log in"), up and out; the account's button. */
    logIn: string
    signUp: string
    logOut: string
    account: string
    /** Signed out, at the foot: Spotify's banner for its preview. */
    previewTitle: string
    previewText: string
    signUpFree: string
    /** The log-in prompt, by what the player tried: to play, to save, to make a playlist. */
    prompts: {
      play: { title: string; text: string }
      save: { title: string; text: string }
      playlist: { title: string; text: string }
    }
    haveAccount: string
    notNow: string
    /** Your Library, signed out: Spotify's two first steps. */
    firstPlaylist: { title: string; text: string; button: string }
    firstPodcasts: { title: string; text: string; button: string }
    /** The "E" of an explicit song. */
    explicit: string
  }
  /** The Music app (Apple Music), in Apple's own words: its tabs and search field; its pages' and sections'
   * words; what things are ("Album · Tarkan"); its buttons, Now Playing's and Up Next's; its sign-in, and the
   * toasts of favouriting and adding to the Library. */
  appleMusic: {
    tabs: { home: string; new: string; radio: string; library: string; search: string }
    searchHint: string
    browseCategories: string
    recentlySearched: string
    clear: string
    topResults: string
    songs: string
    artists: string
    albums: string
    playlists: string
    stations: string
    noResults: string
    noResultsHint: string
    seeAll: string
    recentlyPlayed: string
    recentlyAdded: string
    kinds: {
      album: string
      playlist: string
      artist: string
      station: string
      song: string
      curator: string
      folder: string
    }
    /** "11 songs, 43 minutes" */
    length: (songs: number, seconds: number) => string
    topSongs: string
    play: string
    shuffle: string
    live: string
    explicit: string
    preview: string
    upNext: string
    /** Now Playing's words for the song (Apple Music's Lyrics), none, and who wrote them. */
    lyrics: string
    noLyrics: string
    writtenBy: (names: string) => string
    /** "From Blue Hour" (Up Next, the songs to come from where it plays). */
    from: (name: string) => string
    favorite: string
    favorited: string
    unfavorited: string
    addToLibrary: string
    added: string
    signIn: string
    signOut: string
    /** The account's button (its picture). */
    account: string
    /** A Library list's controls: the filter and More, their choices, and its search field's hint. */
    filter: string
    more: string
    all: { playlists: string; albums: string; songs: string }
    favorites: string
    grid: string
    list: string
    find: string
    /** The playlists' sorts (the other lists' are Apple Music's own words). */
    sorts: { name: string; '-dateAdded': string; '-lastPlayed': string; '-updated': string; type: string }
    /** While Apple Music's sign-in window is open on the PC. */
    finishOnPc: string
    /** Home, signed out. */
    homePitch: { title: string; text: string }
    /** The Library, signed out. */
    libraryPitch: { title: string; text: string }
    /** The sign-in prompt, and why. */
    promptTitle: string
    promptFor: { library: string; favorite: string }
    notNow: string
    /** The banner while songs play as their previews. */
    previewBanner: { title: string; text: string }
    empty: string
    cantPlay: string
    failed: string
    tryAgain: string
    back: string
    close: string
    nowPlaying: string
    next: string
    previous: string
    repeat: string
    volume: string
    mute: string
    unmute: string
  }
  /** YouTube Music: WestPlay's own app, in the look of YouTube Music's tablet app. */
  youtubeMusic: {
    tabs: { home: string; explore: string; library: string; search: string }
    searchHint: string
    remove: string
    more: string
    play: string
    shuffle: string
    radio: string
    save: string
    saved: string
    removed: string
    inLibrary: string
    like: string
    dislike: string
    /** The Song/Video switch. */
    song: string
    video: string
    upNext: string
    lyrics: string
    related: string
    playingFrom: string
    noLyrics: string
    shelves: {
      playlists: string
      songs: string
      albums: string
      artists: string
      subscriptions: string
      history: string
    }
    topResult: string
    /** "1.2M subscribers" */
    subscribers: (count: string) => string
    signIn: string
    signOut: string
    account: string
    /** While Google's sign-in window is open on the PC. */
    finishOnPc: string
    /** The Library, signed out. */
    libraryPitch: { title: string; text: string }
    /** The sign-in prompt, and why. */
    promptTitle: string
    promptFor: { library: string; like: string; save: string }
    notNow: string
    empty: string
    noResults: string
    cantPlay: string
    failed: string
    tryAgain: string
    back: string
    close: string
    nowPlaying: string
    pause: string
    next: string
    previous: string
    repeat: string
    /** An ad playing (YouTube Music's own, if one ever comes through). */
    ad: string
    /** A song's ⋮ and its choices, and what's said as they're made. */
    moreActions: string
    startRadio: string
    playNext: string
    addToQueue: string
    goToAlbum: string
    goToArtist: string
    willPlayNext: string
    addedToQueue: string
    volume: string
  }
  /** NetEase Cloud Music: WestPlay's own app, in the look of NetEase Cloud Music's app. */
  netease: {
    tabs: { home: string; search: string; mine: string }
    /** The two services the app shows (NetEase Cloud Music, QQ Music). */
    sources: { netease: string; qq: string; bilibili: string }
    searchHint: string
    cancel: string
    search: string
    searches: string
    remove: string
    noResults: string
    play: string
    pause: string
    next: string
    previous: string
    shuffle: string
    repeat: string
    volume: string
    lyrics: string
    /** Now Playing's sheet, and what fills it. */
    nowPlaying: string
    playingFrom: string
    upNext: string
    /** A card's or a page's line: what it is. */
    kinds: { song: string; playlist: string; album: string; artist: string; radio: string }
    /** "12 songs" */
    songs: (count: number) => string
    signIn: string
    signOut: string
    account: string
    /** While NetEase's sign-in window is open on the PC. */
    finishOnPc: string
    /** Mine, signed out. */
    signInPitch: { title: string; text: string }
    /** Mine, signed in: what the app shows of the account. */
    mineNote: string
    empty: string
    noLyrics: string
    cantPlay: string
    failed: string
    tryAgain: string
    back: string
    close: string
  }
  /** The Weather app: where the truck is, the game's next change of weather and the roads. */
  weatherApp: {
    myLocation: string
    nextChange: string
    /** "In about 1:42 hrs" */
    inAbout: (time: string) => string
    roads: string
    roadStates: { dry: string; damp: string; wet: string }
    roadTrends: { drying: string; gettingWet: string }
    /** No game, or one whose weather WestPlay can't read. */
    unavailable: string
  }
  /** The Settings app: its pages, rows and the words under them. */
  settings: {
    appearance: string
    light: string
    dark: string
    automatic: string
    automaticFooter: string
    /** The truck's information bar beside WestPlay (the DAF's, the Scania Smart Dash's), and what it is. */
    vehicleBar: string
    vehicleBarFooter: string
    textSize: string
    /** Text Size's own text, shown at the size chosen (iOS's). */
    textSizeAbout: string
    wallpaper: string
    dashboard: string
    widgets: string
    showAlbumArt: string
    /** Sound, and in it the Equalizer: the speakers as tuned (Recommended) or the player's own tone (Custom), what
     * it does, its three bands under the graph, and the curve set back. */
    sound: string
    equalizer: string
    recommended: string
    custom: string
    equalizerFooter: string
    low: string
    mid: string
    high: string
    resetEqualizer: string
    back: string
  }
  /** Apps. */
  apps: Record<AppId, string>
  notBuiltYet: string
}

const ENGLISH_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']

export const STRINGS: Record<Language, Strings> = {
  en: {
    decimal: '.',
    arrival: 'arrival',
    minutes: (minutes) => `${minutes} min`,
    hours: (hours, minutes) => `${hours}:${minutes} hrs`,
    speedLimit: (limit) => `Speed limit ${limit}`,
    now: 'Now',
    then: 'Then',
    arrive: 'Arrive at destination',
    turns: {
      'slight-left': 'Bear left',
      left: 'Turn left',
      'sharp-left': 'Turn sharp left',
      'slight-right': 'Bear right',
      right: 'Turn right',
      'sharp-right': 'Turn sharp right',
      'u-turn': 'Make a U-turn',
      'keep-left': 'Keep left',
      'keep-right': 'Keep right',
      'exit-left': 'Take the exit on the left',
      'exit-right': 'Take the exit on the right',
    },
    roundabout: (exit) => `At the roundabout, take the ${ENGLISH_ORDINALS[exit - 1] ?? `${exit}th`} exit`,
    recentre: 'Recentre',
    northUp: 'North up',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    search: 'Search',
    searchPlaces: 'Search places and cities',
    close: 'Close',
    destinations: {
      favourites: 'Favourites',
      headquarters: 'Headquarters',
      yourGarage: 'Your garage',
      findNearby: 'Find nearby',
      alongRoute: 'Along the route',
      recents: 'Recents',
      kinds: {
        fuel: 'Fuel',
        service: 'Service',
        garage: 'Garage',
        dealer: 'Truck dealer',
        company: 'Company',
        parking: 'Rest area',
        hotel: 'Hotel',
        recruitment: 'Recruitment agency',
        weigh: 'Weigh station',
        ferry: 'Ferry',
        train: 'Train',
        city: 'City',
      },
      nearby: {
        fuel: 'Fuel',
        parking: 'Rest areas',
        service: 'Service',
        hotel: 'Hotels',
        company: 'Companies',
        dealer: 'Dealers',
        ferry: 'Ferries',
        city: 'Cities',
      },
      straightLine: (distance) => `${distance} away`,
      alongTheRoute: (distance) => `${distance} along the route`,
      stopAdds: (distance, time) => `Stop added · adds ${distance} and ${time}`,
      notOnRoute: 'Stop added, but the game’s route doesn’t pass it',
      plans: { fastest: 'Fastest', shortest: 'Shortest', smallRoads: 'Small roads', other: 'Another way' },
      finding: 'Finding routes',
      ownWay: 'Route set: the game takes its own way there',
      go: 'Go',
      addStop: 'Add stop',
      endRoute: 'End route',
      back: 'Back',
      noResults: 'No results',
      loading: 'Loading places',
      noPlaces: 'No places on this map yet',
      done: { go: 'Route set', addStop: 'Stop added', end: 'Route ended' },
      alreadyThere: 'Already a stop on the route',
      full: 'The route has 10 stops, the most the game allows',
      onJob: 'On a job, the destination is the job’s',
      noAnswer: 'The game didn’t answer',
      unsupported: 'This version of the game isn’t supported yet',
      failed: 'The game couldn’t route there',
    },
    keyboard: {
      space: 'space',
      returnKey: { search: 'Search', go: 'Go', done: 'Done' },
      shift: 'Shift',
      capsLock: 'Caps lock',
      delete: 'Delete',
      nextKeyboard: 'Next keyboard',
      hide: 'Hide keyboard',
      clear: 'Clear text',
      typingWithKeyboard: 'Typing with your keyboard',
      pausedWhileDriving: 'Keyboard paused while driving',
      selectToType: 'Select the field to type with your keyboard',
    },
    nowPlaying: 'Now Playing',
    sources: 'Sources',
    previous: 'Previous',
    play: 'Play',
    pause: 'Pause',
    next: 'Next',
    shuffle: 'Shuffle',
    repeat: 'Repeat',
    notPlaying: 'Not Playing',
    openMusicApp: 'Open Apple Music, Spotify or YouTube Music on your PC.',
    nothingLoaded: 'Nothing loaded',
    playing: 'Playing',
    delivery: 'Delivery',
    pickup: 'Pickup',
    destination: 'Destination',
    mapPoint: 'Map point',
    arriveBy: (time) => `Arrive by ${time}`,
    late: 'Late',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weather: { clear: 'Clear', rain: 'Rain' },
    weatherTurning: { clear: 'Clearing up', rain: 'Rain starting' },
    youtube: {
      search: 'Search YouTube',
      continueWatching: 'Continue watching',
      recentSearches: 'Recent searches',
      chips: [
        { label: 'Trucking', query: 'trucking' },
        { label: 'Music', query: 'music' },
        { label: 'Podcasts', query: 'podcast' },
        { label: 'Gaming', query: 'gaming' },
        { label: 'Live', query: 'live' },
      ],
      start: 'What would you like to watch? Search, or pick one above.',
      noResults: 'No results',
      failed: "YouTube didn't answer.",
      tryAgain: 'Try again',
      live: 'LIVE',
      upNext: 'Up next',
      nowPlaying: 'Now playing',
      back: 'Back',
      volume: 'Volume',
      forget: 'Remove',
      fill: 'Put in the box',
      clear: 'Clear',
      fullScreen: 'Full screen',
      signIn: 'Sign in',
      signOut: 'Sign out',
      all: 'All',
      channels: 'Channels',
      subscribe: 'Subscribe',
      subscribed: 'Subscribed',
      playlists: 'Playlists',
      playlist: 'Playlist',
      playAll: 'Play all',
      captions: 'Captions',
      off: 'Off',
      quality: 'Quality',
      auto: 'Auto',
      settings: 'Settings',
      playbackSpeed: 'Playback speed',
      normal: 'Normal',
      audioTrack: 'Audio track',
      stableVolume: 'Stable volume',
      voiceBoost: 'Voice boost',
      home: 'Home',
      subscriptions: 'Subscriptions',
      finishOnPc: 'Finish signing in on your PC: Google’s sign-in is open in a window on your desktop.',
      seconds: (seconds) => `${seconds} seconds`,
    },
    spotify: {
      finishOnPc: 'Finish signing in on your PC: Spotify’s sign-in is open in a window on your desktop.',
      whatToPlay: 'What do you want to play?',
      home: 'Home',
      library: 'Your Library',
      browse: 'Browse',
      back: 'Back',
      filters: { all: 'All', music: 'Music', podcasts: 'Podcasts' },
      showAll: 'Show all',
      browseAll: 'Browse all',
      recentSearches: 'Recent searches',
      clearRecent: 'Clear recent searches',
      forget: 'Remove',
      noResults: (query) => `No results found for “${query}”`,
      noResultsHint: 'Check the spelling, or try fewer or different words.',
      topResult: 'Top result',
      songs: 'Songs',
      artists: 'Artists',
      playlists: 'Playlists',
      albums: 'Albums',
      podcasts: 'Podcasts & Shows',
      kinds: {
        playlist: 'Playlist',
        album: 'Album',
        artist: 'Artist',
        show: 'Podcast',
        liked: 'Playlist',
        song: 'Song',
      },
      songCount: (count) => (count === 1 ? '1 song' : `${count} songs`),
      length: (seconds) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min ${Math.floor(seconds % 60)} sec`
      },
      recents: 'Recents',
      gridView: 'Grid view',
      listView: 'List view',
      verified: 'Verified Artist',
      follow: 'Follow',
      following: 'Following',
      monthlyListeners: (count) => `${count} monthly listeners`,
      popular: 'Popular',
      discography: 'Discography',
      playingFrom: {
        playlist: 'Playing from playlist',
        album: 'Playing from album',
        artist: 'Playing from artist',
        show: 'Playing from podcast',
        liked: 'Playing from your library',
      },
      nowPlaying: 'Now playing',
      queue: 'Queue',
      nextFrom: (name) => `Next from: ${name}`,
      nextUp: 'Next up',
      lyrics: 'Lyrics',
      noLyrics: 'Looks like we don’t have the lyrics for this song.',
      notSynced: 'These lyrics aren’t synced to the song yet.',
      lyricsFrom: (provider) => `Lyrics provided by ${provider}`,
      volume: 'Volume',
      mute: 'Mute',
      unmute: 'Unmute',
      cantPlay: 'Spotify can’t play this right now.',
      failed: 'Something went wrong',
      tryAgain: 'Try again',
      next: 'Next',
      previous: 'Previous',
      shuffle: 'Shuffle',
      repeat: 'Repeat',
      close: 'Close',
      more: 'More options',
      download: 'Download',
      addToLiked: 'Add to Liked Songs',
      addToLibrary: 'Add to Your Library',
      added: 'Added to Liked Songs.',
      removed: 'Removed from Liked Songs.',
      addedToLibrary: 'Added to Your Library.',
      removedFromLibrary: 'Removed from Your Library.',
      logIn: 'Log in',
      signUp: 'Sign up',
      logOut: 'Log out',
      account: 'Account',
      previewTitle: 'Preview of Spotify',
      previewText: 'Sign up to get unlimited songs and podcasts with occasional ads. No credit card needed.',
      signUpFree: 'Sign up free',
      prompts: {
        play: { title: 'Start listening with a free Spotify account', text: '' },
        save: { title: 'Save to Your Library', text: 'Log in to save songs, albums, playlists and artists.' },
        playlist: { title: 'Create a playlist', text: 'Log in to create and share playlists.' },
      },
      haveAccount: 'Already have an account?',
      notNow: 'Not now',
      firstPlaylist: {
        title: 'Create your first playlist',
        text: 'It’s easy, we’ll help you',
        button: 'Create playlist',
      },
      firstPodcasts: {
        title: 'Let’s find some podcasts to follow',
        text: 'We’ll keep you updated on new episodes',
        button: 'Browse podcasts',
      },
      explicit: 'E',
    },
    appleMusic: {
      tabs: { home: 'Home', new: 'New', radio: 'Radio', library: 'Library', search: 'Search' },
      searchHint: 'Artists, Songs, Albums and More',
      browseCategories: 'Browse Categories',
      recentlySearched: 'Recently Searched',
      clear: 'Clear',
      topResults: 'Top Results',
      songs: 'Songs',
      artists: 'Artists',
      albums: 'Albums',
      playlists: 'Playlists',
      stations: 'Stations',
      noResults: 'No Results',
      noResultsHint: 'Try a new search.',
      seeAll: 'See All',
      recentlyPlayed: 'Recently Played',
      recentlyAdded: 'Recently Added',
      kinds: {
        album: 'Album',
        playlist: 'Playlist',
        artist: 'Artist',
        station: 'Station',
        song: 'Song',
        curator: 'Category',
        folder: 'Folder',
      },
      length: (songs, seconds) => {
        const minutes = Math.round(seconds / 60)
        const count = songs === 1 ? '1 song' : `${songs} songs`
        if (minutes < 60) return `${count}, ${minutes === 1 ? '1 minute' : `${minutes} minutes`}`
        const hours = Math.floor(minutes / 60)
        const rest = minutes % 60
        return `${count}, ${hours === 1 ? '1 hour' : `${hours} hours`}${rest ? ` ${rest} minutes` : ''}`
      },
      topSongs: 'Top Songs',
      play: 'Play',
      shuffle: 'Shuffle',
      live: 'LIVE',
      explicit: 'Explicit',
      preview: 'Preview',
      upNext: 'Up Next',
      lyrics: 'Lyrics',
      noLyrics: 'Lyrics aren’t available for this song.',
      writtenBy: (names) => `Written By: ${names}`,
      from: (name) => `From ${name}`,
      favorite: 'Favourite',
      favorited: 'Added to Favourites',
      unfavorited: 'Removed from Favourites',
      addToLibrary: 'Add to Library',
      added: 'Added to Library',
      signIn: 'Sign In',
      signOut: 'Sign Out',
      account: 'Account',
      filter: 'Filter',
      more: 'More',
      all: { playlists: 'All Playlists', albums: 'All Albums', songs: 'All Songs' },
      favorites: 'Favourites',
      grid: 'Grid',
      list: 'List',
      find: 'Search',
      sorts: {
        name: 'Title',
        '-dateAdded': 'Date Added',
        '-lastPlayed': 'Last Played Date',
        '-updated': 'Updated Date',
        type: 'Playlist Type',
      },
      finishOnPc: 'Finish signing in on your PC: Apple Music’s sign-in is open in a window on your desktop.',
      homePitch: {
        title: 'Get more from Apple Music',
        text: 'Sign in for picks made for you, what you played lately and your Library.',
      },
      libraryPitch: { title: 'Your Library', text: 'Sign in to see the music you’ve added.' },
      promptTitle: 'Sign in to Apple Music',
      promptFor: {
        library: 'Sign in to add music to your Library.',
        favorite: 'Sign in to favourite songs.',
      },
      notNow: 'Not Now',
      previewBanner: { title: 'Listen to full songs', text: 'Sign in to play every song in full, not its preview.' },
      empty: 'Nothing here yet.',
      cantPlay: 'Apple Music can’t play this right now.',
      failed: 'Couldn’t load this.',
      tryAgain: 'Try Again',
      back: 'Back',
      close: 'Close',
      nowPlaying: 'Now Playing',
      next: 'Next',
      previous: 'Previous',
      repeat: 'Repeat',
      volume: 'Volume',
      mute: 'Mute',
      unmute: 'Unmute',
    },
    youtubeMusic: {
      tabs: { home: 'Home', explore: 'Explore', library: 'Library', search: 'Search' },
      searchHint: 'Search songs, artists, podcasts',
      remove: 'Remove',
      more: 'More',
      play: 'Play',
      shuffle: 'Shuffle',
      radio: 'Radio',
      save: 'Save to library',
      saved: 'Saved to library',
      removed: 'Removed from library',
      inLibrary: 'Saved',
      like: 'Like',
      dislike: 'Dislike',
      song: 'Song',
      video: 'Video',
      upNext: 'Up next',
      lyrics: 'Lyrics',
      related: 'Related',
      playingFrom: 'Playing from',
      noLyrics: 'Lyrics aren’t available for this song.',
      shelves: {
        playlists: 'Playlists',
        songs: 'Songs',
        albums: 'Albums',
        artists: 'Artists',
        subscriptions: 'Subscriptions',
        history: 'History',
      },
      topResult: 'Top result',
      subscribers: (count) => `${count} subscribers`,
      signIn: 'Sign in',
      signOut: 'Sign out',
      account: 'Account',
      finishOnPc: 'Finish signing in on your PC.',
      libraryPitch: {
        title: 'Enjoy your favourite music',
        text: 'Sign in to see your playlists, liked songs and albums. Your YouTube sign-in works here too.',
      },
      promptTitle: 'Sign in to YouTube Music',
      promptFor: {
        library: 'Your playlists, songs and albums are in your library.',
        like: 'Songs you like go to your Liked music.',
        save: 'Albums and playlists you save go to your library.',
      },
      notNow: 'Not now',
      empty: 'Nothing here yet.',
      noResults: 'No results',
      cantPlay: 'YouTube Music can’t play this right now.',
      failed: 'Couldn’t load this.',
      tryAgain: 'Try again',
      back: 'Back',
      close: 'Close',
      nowPlaying: 'Now playing',
      pause: 'Pause',
      next: 'Next',
      previous: 'Previous',
      repeat: 'Repeat',
      ad: 'Ad',
      moreActions: 'More actions',
      startRadio: 'Start radio',
      playNext: 'Play next',
      addToQueue: 'Add to queue',
      goToAlbum: 'Go to album',
      goToArtist: 'Go to artist',
      willPlayNext: 'Song will play next',
      addedToQueue: 'Song added to queue',
      volume: 'Volume',
    },
    netease: {
      tabs: { home: 'Home', search: 'Search', mine: 'Mine' },
      sources: { netease: 'NetEase', qq: 'QQ Music', bilibili: 'Bilibili' },
      searchHint: 'Search songs, artists, playlists',
      cancel: 'Cancel',
      search: 'Search',
      searches: 'Recent searches',
      remove: 'Remove',
      noResults: 'No results',
      play: 'Play',
      pause: 'Pause',
      next: 'Next',
      previous: 'Previous',
      shuffle: 'Shuffle',
      repeat: 'Repeat',
      volume: 'Volume',
      lyrics: 'Lyrics',
      nowPlaying: 'Now playing',
      playingFrom: 'Playing from',
      upNext: 'Up next',
      kinds: { song: 'Songs', playlist: 'Playlists', album: 'Albums', artist: 'Artists', radio: 'Radio' },
      songs: (count) => (count === 1 ? '1 song' : `${count} songs`),
      signIn: 'Sign in',
      signOut: 'Sign out',
      account: 'Account',
      finishOnPc: 'Finish signing in on your PC.',
      signInPitch: {
        title: 'Your music, everywhere',
        text: 'Sign in to NetEase Cloud Music to see your playlists and your liked songs. Its own QR code signs you in, scanned with the app on your phone.',
      },
      mineNote: 'Your playlists and liked songs are NetEase’s own; WestPlay shows what it can of them.',
      empty: 'Nothing here yet.',
      noLyrics: 'Lyrics aren’t available for this song.',
      cantPlay: 'NetEase Cloud Music can’t play this right now.',
      failed: 'Couldn’t load this.',
      tryAgain: 'Try again',
      back: 'Back',
      close: 'Close',
    },
    weatherApp: {
      myLocation: 'My Location',
      nextChange: 'Next change',
      inAbout: (time) => `In about ${time}`,
      roads: 'Roads',
      roadStates: { dry: 'Dry', damp: 'Damp', wet: 'Wet' },
      roadTrends: { drying: 'Drying', gettingWet: 'Getting wetter' },
      unavailable: 'The weather shows while the game runs.',
    },
    settings: {
      appearance: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      automatic: 'Automatic',
      automaticFooter: 'Dark at night and whenever the headlights are on, the way the truck’s light sensor does it.',
      vehicleBar: 'Vehicle Bar',
      vehicleBarFooter: 'The truck’s information bar beside WestPlay. Turned off, WestPlay fills the whole screen.',
      textSize: 'Text Size',
      textSizeAbout: 'WestPlay’s apps will adjust to your preferred reading size below.',
      wallpaper: 'Wallpaper',
      dashboard: 'Dashboard',
      widgets: 'Widgets',
      showAlbumArt: 'Show Album Art',
      sound: 'Sound',
      equalizer: 'Equalizer',
      recommended: 'Recommended',
      custom: 'Custom',
      equalizerFooter:
        'WestPlay plays your music through each truck’s own speakers, tuned for its cab. If you prefer a different sound, you can customise how every music app sounds, in every truck.',
      low: 'Low',
      mid: 'Mid',
      high: 'High',
      resetEqualizer: 'Reset',
      back: 'Back',
    },
    apps: {
      maps: 'Maps',
      music: 'Music',
      spotify: 'Spotify',
      youtube: 'YouTube',
      youtubeMusic: 'YouTube Music',
      netease: 'NetEase Cloud Music',
      podcasts: 'Podcasts',
      phone: 'Phone',
      messages: 'Messages',
      weather: 'Weather',
      settings: 'Settings',
    },
    notBuiltYet: 'Not built yet',
  },
  tr: {
    decimal: ',',
    arrival: 'varış',
    minutes: (minutes) => `${minutes} dk`,
    hours: (hours, minutes) => `${hours}:${minutes} sa`,
    speedLimit: (limit) => `Hız sınırı ${limit}`,
    now: 'Şimdi',
    then: 'Sonra',
    arrive: 'Varış noktasına ulaşın',
    turns: {
      'slight-left': 'Hafif sola dönün',
      left: 'Sola dönün',
      'sharp-left': 'Keskin sola dönün',
      'slight-right': 'Hafif sağa dönün',
      right: 'Sağa dönün',
      'sharp-right': 'Keskin sağa dönün',
      'u-turn': 'U dönüşü yapın',
      'keep-left': 'Soldan devam edin',
      'keep-right': 'Sağdan devam edin',
      'exit-left': 'Soldaki çıkışa girin',
      'exit-right': 'Sağdaki çıkışa girin',
    },
    roundabout: (exit) => `Dönel kavşakta ${exit}. çıkıştan çıkın`,
    recentre: 'Ortala',
    northUp: 'Kuzey yukarı',
    zoomIn: 'Yakınlaştır',
    zoomOut: 'Uzaklaştır',
    search: 'Ara',
    searchPlaces: 'Yer ve şehir arayın',
    close: 'Kapat',
    destinations: {
      favourites: 'Favoriler',
      headquarters: 'Merkez',
      yourGarage: 'Garajınız',
      findNearby: 'Yakındakiler',
      alongRoute: 'Rota üzerinde',
      recents: 'Son kullanılanlar',
      kinds: {
        fuel: 'Akaryakıt',
        service: 'Servis',
        garage: 'Garaj',
        dealer: 'Tır bayisi',
        company: 'Şirket',
        parking: 'Mola yeri',
        hotel: 'Otel',
        recruitment: 'İş kurumu',
        weigh: 'Denetim istasyonu',
        ferry: 'Feribot',
        train: 'Tren',
        city: 'Şehir',
      },
      nearby: {
        fuel: 'Akaryakıt',
        parking: 'Mola yerleri',
        service: 'Servis',
        hotel: 'Oteller',
        company: 'Şirketler',
        dealer: 'Bayiler',
        ferry: 'Feribotlar',
        city: 'Şehirler',
      },
      straightLine: (distance) => `${distance} uzaklıkta`,
      alongTheRoute: (distance) => `Rotada ${distance} ileride`,
      stopAdds: (distance, time) => `Durak eklendi · ${distance} ve ${time} ekliyor`,
      notOnRoute: 'Durak eklendi, ama oyunun rotası oradan geçmiyor',
      plans: { fastest: 'En hızlı', shortest: 'En kısa', smallRoads: 'Küçük yollar', other: 'Başka bir yol' },
      finding: 'Rotalar bulunuyor',
      ownWay: 'Rota ayarlandı: oyun oraya kendi yolundan gidiyor',
      go: 'Git',
      addStop: 'Durak ekle',
      endRoute: 'Rotayı bitir',
      back: 'Geri',
      noResults: 'Sonuç yok',
      loading: 'Yerler yükleniyor',
      noPlaces: 'Bu haritada henüz yer yok',
      done: { go: 'Rota ayarlandı', addStop: 'Durak eklendi', end: 'Rota bitirildi' },
      alreadyThere: 'Zaten rotada bir durak',
      full: 'Rotada 10 durak var, oyunun izin verdiği en fazla',
      onJob: 'İşteyken varış noktası işin',
      noAnswer: 'Oyun yanıt vermedi',
      unsupported: 'Oyunun bu sürümü henüz desteklenmiyor',
      failed: 'Oyun oraya rota çizemedi',
    },
    keyboard: {
      space: 'boşluk',
      returnKey: { search: 'Ara', go: 'Git', done: 'Bitti' },
      shift: 'Büyük harf',
      capsLock: 'Büyük harf kilidi',
      delete: 'Sil',
      nextKeyboard: 'Sonraki klavye',
      hide: 'Klavyeyi gizle',
      clear: 'Metni temizle',
      typingWithKeyboard: 'Klavyenizle yazıyorsunuz',
      pausedWhileDriving: 'Sürüş sırasında klavye duraklatıldı',
      selectToType: 'Klavyenizle yazmak için alanı seçin',
    },
    nowPlaying: 'Şimdi Çalıyor',
    sources: 'Kaynaklar',
    previous: 'Önceki',
    play: 'Oynat',
    pause: 'Duraklat',
    next: 'Sonraki',
    shuffle: 'Karıştır',
    repeat: 'Tekrarla',
    notPlaying: 'Çalmıyor',
    openMusicApp: 'Bilgisayarınızda Apple Music, Spotify veya YouTube Music’i açın.',
    nothingLoaded: 'Hiçbir şey yüklenmedi',
    playing: 'Çalıyor',
    delivery: 'Teslimat',
    pickup: 'Yükleme',
    destination: 'Hedef',
    mapPoint: 'Harita noktası',
    arriveBy: (time) => `Son varış ${time}`,
    late: 'Gecikti',
    days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    weather: { clear: 'Açık', rain: 'Yağmur' },
    weatherTurning: { clear: 'Açılıyor', rain: 'Yağmur başlıyor' },
    youtube: {
      search: 'YouTube’da ara',
      continueWatching: 'İzlemeye devam et',
      recentSearches: 'Son aramalar',
      chips: [
        { label: 'Tır', query: 'tır yolculuğu' },
        { label: 'Müzik', query: 'müzik' },
        { label: 'Podcast', query: 'podcast' },
        { label: 'Oyun', query: 'oyun' },
        { label: 'Canlı', query: 'canlı yayın' },
      ],
      start: 'Ne izlemek istersiniz? Arayın ya da yukarıdan seçin.',
      noResults: 'Sonuç yok',
      failed: 'YouTube yanıt vermedi.',
      tryAgain: 'Tekrar dene',
      live: 'CANLI',
      upNext: 'Sıradaki',
      nowPlaying: 'Şimdi oynatılıyor',
      back: 'Geri',
      volume: 'Ses',
      forget: 'Kaldır',
      fill: 'Kutuya koy',
      clear: 'Temizle',
      fullScreen: 'Tam ekran',
      signIn: 'Oturum aç',
      signOut: 'Oturumu kapat',
      all: 'Tümü',
      channels: 'Kanallar',
      subscribe: 'Abone ol',
      subscribed: 'Abone olundu',
      playlists: 'Oynatma listeleri',
      playlist: 'Oynatma listesi',
      playAll: 'Tümünü oynat',
      captions: 'Altyazılar',
      off: 'Kapalı',
      quality: 'Kalite',
      auto: 'Otomatik',
      settings: 'Ayarlar',
      playbackSpeed: 'Oynatma hızı',
      normal: 'Normal',
      audioTrack: 'Ses parçası',
      stableVolume: 'Sabit ses seviyesi',
      voiceBoost: 'Ses güçlendirme',
      home: 'Ana Sayfa',
      subscriptions: 'Abonelikler',
      finishOnPc: 'Oturum açmayı bilgisayarınızda tamamlayın: Google’ın oturum açma penceresi masaüstünüzde açık.',
      seconds: (seconds) => `${seconds} saniye`,
    },
    spotify: {
      finishOnPc: 'Oturum açmayı bilgisayarınızda tamamlayın: Spotify’ın oturum açma penceresi masaüstünüzde açık.',
      whatToPlay: 'Ne çalmak istiyorsun?',
      home: 'Ana sayfa',
      library: 'Kitaplığın',
      browse: 'Göz at',
      back: 'Geri',
      filters: { all: 'Tümü', music: 'Müzik', podcasts: 'Podcast’ler' },
      showAll: 'Tümünü göster',
      browseAll: 'Hepsine göz at',
      recentSearches: 'Son aramalar',
      clearRecent: 'Son aramaları temizle',
      forget: 'Kaldır',
      noResults: (query) => `“${query}” için sonuç bulunamadı`,
      noResultsHint: 'Yazımı kontrol et ya da daha az veya farklı kelimeler dene.',
      topResult: 'En iyi sonuç',
      songs: 'Şarkılar',
      artists: 'Sanatçılar',
      playlists: 'Çalma listeleri',
      albums: 'Albümler',
      podcasts: 'Podcast’ler ve Programlar',
      kinds: {
        playlist: 'Çalma listesi',
        album: 'Albüm',
        artist: 'Sanatçı',
        show: 'Podcast',
        liked: 'Çalma listesi',
        song: 'Şarkı',
      },
      songCount: (count) => `${count} şarkı`,
      length: (seconds) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return hours > 0 ? `${hours} sa. ${minutes} dk.` : `${minutes} dk. ${Math.floor(seconds % 60)} sn.`
      },
      recents: 'En son',
      gridView: 'Izgara görünümü',
      listView: 'Liste görünümü',
      verified: 'Onaylanmış Sanatçı',
      follow: 'Takip et',
      following: 'Takip ediliyor',
      monthlyListeners: (count) => `${count} aylık dinleyici`,
      popular: 'Popüler',
      discography: 'Diskografi',
      playingFrom: {
        playlist: 'Çalma listesinden çalınıyor',
        album: 'Albümden çalınıyor',
        artist: 'Sanatçıdan çalınıyor',
        show: 'Podcast’ten çalınıyor',
        liked: 'Kitaplığından çalınıyor',
      },
      nowPlaying: 'Şu anda çalan',
      queue: 'Sıra',
      nextFrom: (name) => `Sıradaki: ${name}`,
      nextUp: 'Sıradakiler',
      lyrics: 'Şarkı sözleri',
      noLyrics: 'Görünüşe göre bu şarkının sözleri bizde yok.',
      notSynced: 'Bu sözler henüz şarkıyla eşzamanlı değil.',
      lyricsFrom: (provider) => `Şarkı sözlerini sağlayan: ${provider}`,
      volume: 'Ses düzeyi',
      mute: 'Sesi kapat',
      unmute: 'Sesi aç',
      cantPlay: 'Spotify bunu şu anda çalamıyor.',
      failed: 'Bir şeyler ters gitti',
      tryAgain: 'Tekrar dene',
      next: 'Sonraki',
      previous: 'Önceki',
      shuffle: 'Karıştır',
      repeat: 'Tekrarla',
      close: 'Kapat',
      more: 'Diğer seçenekler',
      download: 'İndir',
      addToLiked: 'Beğenilen Şarkılar’a ekle',
      addToLibrary: 'Kitaplığına ekle',
      added: 'Beğenilen Şarkılar’a eklendi.',
      removed: 'Beğenilen Şarkılar’dan kaldırıldı.',
      addedToLibrary: 'Kitaplığına eklendi.',
      removedFromLibrary: 'Kitaplığından kaldırıldı.',
      logIn: 'Oturum aç',
      signUp: 'Kaydol',
      logOut: 'Oturumu kapat',
      account: 'Hesap',
      previewTitle: 'Spotify önizlemesi',
      previewText: 'Ara sıra reklamlarla sınırsız şarkı ve podcast dinlemek için kaydol. Kredi kartı gerekmez.',
      signUpFree: 'Ücretsiz kaydol',
      prompts: {
        play: { title: 'Ücretsiz bir Spotify hesabıyla dinlemeye başla', text: '' },
        save: {
          title: 'Kitaplığına kaydet',
          text: 'Şarkıları, albümleri, çalma listelerini ve sanatçıları kaydetmek için oturum aç.',
        },
        playlist: { title: 'Çalma listesi oluştur', text: 'Çalma listesi oluşturmak ve paylaşmak için oturum aç.' },
      },
      haveAccount: 'Zaten bir hesabın var mı?',
      notNow: 'Şimdi değil',
      firstPlaylist: {
        title: 'İlk çalma listeni oluştur',
        text: 'Çok kolay, sana yardım edeceğiz',
        button: 'Çalma listesi oluştur',
      },
      firstPodcasts: {
        title: 'Takip edeceğin podcast’leri bulalım',
        text: 'Yeni bölümlerden seni haberdar edeceğiz',
        button: 'Podcast’lere göz at',
      },
      explicit: 'E',
    },
    appleMusic: {
      tabs: { home: 'Ana Sayfa', new: 'Yeni', radio: 'Radyo', library: 'Kütüphane', search: 'Ara' },
      searchHint: 'Sanatçılar, Şarkılar, Albümler ve Daha Fazlası',
      browseCategories: 'Kategorilere Göz At',
      recentlySearched: 'Son Aramalar',
      clear: 'Temizle',
      topResults: 'En İyi Sonuçlar',
      songs: 'Şarkılar',
      artists: 'Sanatçılar',
      albums: 'Albümler',
      playlists: 'Çalma Listeleri',
      stations: 'İstasyonlar',
      noResults: 'Sonuç Yok',
      noResultsHint: 'Yeni bir arama deneyin.',
      seeAll: 'Tümünü Gör',
      recentlyPlayed: 'Son Çalınanlar',
      recentlyAdded: 'Son Eklenenler',
      kinds: {
        album: 'Albüm',
        playlist: 'Çalma Listesi',
        artist: 'Sanatçı',
        station: 'İstasyon',
        song: 'Şarkı',
        curator: 'Kategori',
        folder: 'Klasör',
      },
      length: (songs, seconds) => {
        const minutes = Math.round(seconds / 60)
        if (minutes < 60) return `${songs} şarkı, ${minutes} dakika`
        const rest = minutes % 60
        return `${songs} şarkı, ${Math.floor(minutes / 60)} saat${rest ? ` ${rest} dakika` : ''}`
      },
      topSongs: 'Popüler Şarkılar',
      play: 'Çal',
      shuffle: 'Karıştır',
      live: 'CANLI',
      explicit: 'Müstehcen',
      preview: 'Önizleme',
      upNext: 'Sıradakiler',
      lyrics: 'Sözler',
      noLyrics: 'Bu şarkının sözleri yok.',
      writtenBy: (names) => `Yazanlar: ${names}`,
      from: (name) => `Kaynak: ${name}`,
      favorite: 'Favori',
      favorited: 'Favorilere Eklendi',
      unfavorited: 'Favorilerden Kaldırıldı',
      addToLibrary: 'Kütüphaneye Ekle',
      added: 'Kütüphaneye Eklendi',
      signIn: 'Giriş Yap',
      signOut: 'Çıkış Yap',
      account: 'Hesap',
      filter: 'Filtre',
      more: 'Diğer',
      all: { playlists: 'Tüm Çalma Listeleri', albums: 'Tüm Albümler', songs: 'Tüm Şarkılar' },
      favorites: 'Favoriler',
      grid: 'Izgara',
      list: 'Liste',
      find: 'Ara',
      sorts: {
        name: 'Başlık',
        '-dateAdded': 'Eklenme Tarihi',
        '-lastPlayed': 'Son Çalınma Tarihi',
        '-updated': 'Güncellenme Tarihi',
        type: 'Çalma Listesi Türü',
      },
      finishOnPc: 'Girişi bilgisayarınızda tamamlayın: Apple Music’in giriş penceresi masaüstünüzde açık.',
      homePitch: {
        title: 'Apple Music’ten daha fazlası',
        text: 'Size özel seçimler, son dinledikleriniz ve Kütüphaneniz için giriş yapın.',
      },
      libraryPitch: { title: 'Kütüphaneniz', text: 'Eklediğiniz müziği görmek için giriş yapın.' },
      promptTitle: 'Apple Music’e Giriş Yapın',
      promptFor: {
        library: 'Kütüphanenize müzik eklemek için giriş yapın.',
        favorite: 'Şarkıları favorilere eklemek için giriş yapın.',
      },
      notNow: 'Şimdi Değil',
      previewBanner: {
        title: 'Şarkıların tamamını dinleyin',
        text: 'Her şarkıyı önizlemesi yerine tamamen çalmak için giriş yapın.',
      },
      empty: 'Burada henüz bir şey yok.',
      cantPlay: 'Apple Music bunu şu anda çalamıyor.',
      failed: 'Yüklenemedi.',
      tryAgain: 'Yeniden Dene',
      back: 'Geri',
      close: 'Kapat',
      nowPlaying: 'Şimdi Çalıyor',
      next: 'Sonraki',
      previous: 'Önceki',
      repeat: 'Tekrarla',
      volume: 'Ses',
      mute: 'Sesi Kapat',
      unmute: 'Sesi Aç',
    },
    youtubeMusic: {
      tabs: { home: 'Ana Sayfa', explore: 'Keşfet', library: 'Kitaplık', search: 'Ara' },
      searchHint: 'Şarkı, sanatçı, podcast ara',
      remove: 'Kaldır',
      more: 'Daha fazla',
      play: 'Oynat',
      shuffle: 'Karıştır',
      radio: 'Radyo',
      save: 'Kitaplığa kaydet',
      saved: 'Kitaplığa kaydedildi',
      removed: 'Kitaplıktan kaldırıldı',
      inLibrary: 'Kaydedildi',
      like: 'Beğen',
      dislike: 'Beğenme',
      song: 'Şarkı',
      video: 'Video',
      upNext: 'Sıradaki',
      lyrics: 'Şarkı sözleri',
      related: 'İlgili',
      playingFrom: 'Şuradan çalınıyor',
      noLyrics: 'Bu şarkının sözleri yok.',
      shelves: {
        playlists: 'Çalma listeleri',
        songs: 'Şarkılar',
        albums: 'Albümler',
        artists: 'Sanatçılar',
        subscriptions: 'Abonelikler',
        history: 'Geçmiş',
      },
      topResult: 'En iyi sonuç',
      subscribers: (count) => `${count} abone`,
      signIn: 'Oturum aç',
      signOut: 'Oturumu kapat',
      account: 'Hesap',
      finishOnPc: 'Oturum açmayı bilgisayarınızda tamamlayın.',
      libraryPitch: {
        title: 'Sevdiğiniz müziğin keyfini çıkarın',
        text: 'Çalma listelerinizi, beğendiğiniz şarkıları ve albümlerinizi görmek için oturum açın. YouTube oturumunuz burada da geçerli.',
      },
      promptTitle: 'YouTube Music’te oturum açın',
      promptFor: {
        library: 'Çalma listeleriniz, şarkılarınız ve albümleriniz kitaplığınızda.',
        like: 'Beğendiğiniz şarkılar Beğenilen müzikler listenize eklenir.',
        save: 'Kaydettiğiniz albümler ve çalma listeleri kitaplığınıza eklenir.',
      },
      notNow: 'Şimdi değil',
      empty: 'Burada henüz bir şey yok.',
      noResults: 'Sonuç yok',
      cantPlay: 'YouTube Music bunu şu anda çalamıyor.',
      failed: 'Yüklenemedi.',
      tryAgain: 'Tekrar dene',
      back: 'Geri',
      close: 'Kapat',
      nowPlaying: 'Şimdi çalıyor',
      pause: 'Duraklat',
      next: 'Sonraki',
      previous: 'Önceki',
      repeat: 'Tekrarla',
      ad: 'Reklam',
      moreActions: 'Diğer işlemler',
      startRadio: 'Radyoyu başlat',
      playNext: 'Sıradaki olarak çal',
      addToQueue: 'Sıraya ekle',
      goToAlbum: 'Albüme git',
      goToArtist: 'Sanatçıya git',
      willPlayNext: 'Şarkı sıradaki olarak çalınacak',
      addedToQueue: 'Şarkı sıraya eklendi',
      volume: 'Ses',
    },
    netease: {
      tabs: { home: 'Ana Sayfa', search: 'Ara', mine: 'Benim' },
      sources: { netease: 'NetEase', qq: 'QQ Music', bilibili: 'Bilibili' },
      searchHint: 'Şarkı, sanatçı, çalma listesi ara',
      cancel: 'İptal',
      search: 'Ara',
      searches: 'Son aramalar',
      remove: 'Kaldır',
      noResults: 'Sonuç yok',
      play: 'Oynat',
      pause: 'Duraklat',
      next: 'Sonraki',
      previous: 'Önceki',
      shuffle: 'Karıştır',
      repeat: 'Tekrarla',
      volume: 'Ses',
      lyrics: 'Şarkı sözleri',
      nowPlaying: 'Şimdi çalıyor',
      playingFrom: 'Şuradan çalınıyor',
      upNext: 'Sıradaki',
      kinds: { song: 'Şarkılar', playlist: 'Çalma listeleri', album: 'Albümler', artist: 'Sanatçılar', radio: 'Radyo' },
      songs: (count) => `${count} şarkı`,
      signIn: 'Oturum aç',
      signOut: 'Oturumu kapat',
      account: 'Hesap',
      finishOnPc: 'Oturum açmayı bilgisayarınızda tamamlayın.',
      signInPitch: {
        title: 'Müziğiniz her yerde',
        text: 'Çalma listelerinizi ve beğendiğiniz şarkıları görmek için NetEase Cloud Music’te oturum açın. Kendi QR kodu, telefonunuzdaki uygulamayla okutularak sizi oturuma sokar.',
      },
      mineNote:
        'Çalma listeleriniz ve beğendiğiniz şarkılar NetEase’in kendi listeleridir; WestPlay onlardan gösterebildiğini gösterir.',
      empty: 'Burada henüz bir şey yok.',
      noLyrics: 'Bu şarkının sözleri yok.',
      cantPlay: 'NetEase Cloud Music bunu şu anda çalamıyor.',
      failed: 'Yüklenemedi.',
      tryAgain: 'Tekrar dene',
      back: 'Geri',
      close: 'Kapat',
    },
    weatherApp: {
      myLocation: 'Konumum',
      nextChange: 'Sonraki değişim',
      inAbout: (time) => `Yaklaşık ${time} sonra`,
      roads: 'Yollar',
      roadStates: { dry: 'Kuru', damp: 'Nemli', wet: 'Islak' },
      roadTrends: { drying: 'Kuruyor', gettingWet: 'Islanıyor' },
      unavailable: 'Hava durumu oyun açıkken görünür.',
    },
    settings: {
      appearance: 'Görünüm',
      light: 'Açık',
      dark: 'Koyu',
      automatic: 'Otomatik',
      automaticFooter: 'Geceleri ve farlar her yandığında koyu; tıpkı kamyonun ışık sensörü gibi.',
      vehicleBar: 'Araç Çubuğu',
      vehicleBarFooter: 'WestPlay’in yanındaki kamyon bilgi çubuğu. Kapatırsan WestPlay tüm ekranı kaplar.',
      textSize: 'Metin Boyutu',
      textSizeAbout: 'WestPlay’in uygulamaları aşağıda seçtiğin okuma boyutuna göre ayarlanır.',
      wallpaper: 'Duvar Kâğıdı',
      dashboard: 'Gösterge Paneli',
      widgets: 'Widget’lar',
      showAlbumArt: 'Albüm Kapağını Göster',
      sound: 'Ses',
      equalizer: 'Ekolayzır',
      recommended: 'Önerilen',
      custom: 'Özel',
      equalizerFooter:
        'WestPlay müziğini her kamyonun kendi hoparlörlerinden, kabinine göre ayarlanmış olarak çalar. Farklı bir ses istersen, her müzik uygulamasının her kamyonda nasıl çalacağını özelleştirebilirsin.',
      low: 'Düşük',
      mid: 'Orta',
      high: 'Yüksek',
      resetEqualizer: 'Sıfırla',
      back: 'Geri',
    },
    apps: {
      maps: 'Haritalar',
      music: 'Müzik',
      spotify: 'Spotify',
      youtube: 'YouTube',
      youtubeMusic: 'YouTube Music',
      netease: 'NetEase Cloud Music',
      podcasts: 'Podcast’ler',
      phone: 'Telefon',
      messages: 'Mesajlar',
      weather: 'Hava Durumu',
      settings: 'Ayarlar',
    },
    notBuiltYet: 'Henüz hazır değil',
  },
  /**
   * The Chinese table follows the English one, key for key, in the mainland's own words (Simplified): brands
   * keep their names, units stay Latin (km), and numbers and units are spaced as Chinese UI text does.
   */
  zh: {
    decimal: '.',
    arrival: '到达',
    minutes: (minutes) => `${minutes} 分钟`,
    hours: (hours, minutes) => `${hours} 小时 ${minutes} 分`,
    speedLimit: (limit) => `限速 ${limit}`,
    now: '现在',
    then: '然后',
    arrive: '到达目的地',
    turns: {
      'slight-left': '向左前方行驶',
      left: '左转',
      'sharp-left': '向左急转',
      'slight-right': '向右前方行驶',
      right: '右转',
      'sharp-right': '向右急转',
      'u-turn': '掉头',
      'keep-left': '靠左行驶',
      'keep-right': '靠右行驶',
      'exit-left': '从左侧出口驶出',
      'exit-right': '从右侧出口驶出',
    },
    roundabout: (exit) => `进入环岛，从第 ${exit} 个出口驶出`,
    recentre: '回到当前位置',
    northUp: '正北朝上',
    zoomIn: '放大',
    zoomOut: '缩小',
    search: '搜索',
    searchPlaces: '搜索地点和城市',
    close: '关闭',
    destinations: {
      favourites: '收藏',
      headquarters: '总部',
      yourGarage: '你的车库',
      findNearby: '查找附近',
      alongRoute: '沿路线',
      recents: '最近记录',
      kinds: {
        fuel: '加油站',
        service: '服务站',
        garage: '车库',
        dealer: '卡车经销商',
        company: '公司',
        parking: '休息区',
        hotel: '酒店',
        recruitment: '招聘机构',
        weigh: '称重站',
        ferry: '轮渡',
        train: '火车站',
        city: '城市',
      },
      nearby: {
        fuel: '加油站',
        parking: '休息区',
        service: '服务站',
        hotel: '酒店',
        company: '公司',
        dealer: '经销商',
        ferry: '轮渡',
        city: '城市',
      },
      straightLine: (distance) => `相距 ${distance}`,
      alongTheRoute: (distance) => `路线前方 ${distance}`,
      stopAdds: (distance, time) => `已添加途经点 · 增加 ${distance} 和 ${time}`,
      notOnRoute: '已添加途经点，但游戏规划的路线不经过该地点',
      plans: { fastest: '最快', shortest: '最短', smallRoads: '小路', other: '其他路线' },
      finding: '正在规划路线',
      ownWay: '路线已设定：游戏将按自己的路线前往',
      go: '出发',
      addStop: '添加途经点',
      endRoute: '结束路线',
      back: '返回',
      noResults: '无结果',
      loading: '正在加载地点',
      noPlaces: '地图上暂无地点',
      done: { go: '路线已设定', addStop: '已添加途经点', end: '路线已结束' },
      alreadyThere: '该地点已是路线上的途经点',
      full: '路线已有 10 个途经点，已达游戏允许的上限',
      onJob: '执行任务时，目的地由任务决定',
      noAnswer: '游戏没有响应',
      unsupported: '尚不支持此版本的游戏',
      failed: '游戏无法规划到该地点的路线',
    },
    keyboard: {
      space: '空格',
      returnKey: { search: '搜索', go: '前往', done: '完成' },
      shift: '上档键',
      capsLock: '大写锁定',
      delete: '删除',
      nextKeyboard: '切换键盘',
      hide: '隐藏键盘',
      clear: '清除文本',
      typingWithKeyboard: '正在使用键盘输入',
      pausedWhileDriving: '行驶中键盘已暂停',
      selectToType: '选择输入框，即可用键盘输入',
    },
    nowPlaying: '正在播放',
    sources: '来源',
    previous: '上一首',
    play: '播放',
    pause: '暂停',
    next: '下一首',
    shuffle: '随机播放',
    repeat: '循环播放',
    notPlaying: '未在播放',
    openMusicApp: '请在电脑上打开 Apple Music、Spotify 或 YouTube Music。',
    nothingLoaded: '未加载内容',
    playing: '播放中',
    delivery: '送货',
    pickup: '提货',
    destination: '目的地',
    mapPoint: '地图选点',
    arriveBy: (time) => `最晚 ${time} 到达`,
    late: '已超时',
    days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    weather: { clear: '晴', rain: '雨' },
    weatherTurning: { clear: '转晴', rain: '开始下雨' },
    youtube: {
      search: '搜索 YouTube',
      continueWatching: '继续观看',
      recentSearches: '最近搜索',
      chips: [
        { label: '卡车', query: '卡车' },
        { label: '音乐', query: '音乐' },
        { label: '播客', query: '播客' },
        { label: '游戏', query: '游戏' },
        { label: '直播', query: '直播' },
      ],
      start: '想看点什么？搜索一下，或从上方选一个。',
      noResults: '无结果',
      failed: 'YouTube 没有响应。',
      tryAgain: '重试',
      live: '直播',
      upNext: '接下来',
      nowPlaying: '正在播放',
      back: '返回',
      volume: '音量',
      forget: '移除',
      fill: '填入搜索框',
      clear: '清除',
      fullScreen: '全屏',
      signIn: '登录',
      signOut: '退出登录',
      all: '全部',
      channels: '频道',
      subscribe: '订阅',
      subscribed: '已订阅',
      playlists: '播放列表',
      playlist: '播放列表',
      playAll: '全部播放',
      captions: '字幕',
      off: '关闭',
      quality: '画质',
      auto: '自动',
      settings: '设置',
      playbackSpeed: '播放速度',
      normal: '正常',
      audioTrack: '音轨',
      stableVolume: '稳定音量',
      voiceBoost: '人声增强',
      home: '首页',
      subscriptions: '订阅内容',
      finishOnPc: '请在电脑上完成登录：Google 的登录窗口已在你的桌面打开。',
      seconds: (seconds) => `${seconds} 秒`,
    },
    spotify: {
      finishOnPc: '请在电脑上完成登录：Spotify 的登录窗口已在你的桌面打开。',
      whatToPlay: '想听点什么？',
      home: '首页',
      library: '你的音乐库',
      browse: '浏览',
      back: '返回',
      filters: { all: '全部', music: '音乐', podcasts: '播客' },
      showAll: '显示全部',
      browseAll: '浏览全部',
      recentSearches: '最近搜索',
      clearRecent: '清除搜索记录',
      forget: '移除',
      noResults: (query) => `未找到“${query}”的相关结果`,
      noResultsHint: '请检查拼写，或尝试更少、不同的关键词。',
      topResult: '最佳结果',
      songs: '歌曲',
      artists: '艺人',
      playlists: '歌单',
      albums: '专辑',
      podcasts: '播客和节目',
      kinds: {
        playlist: '歌单',
        album: '专辑',
        artist: '艺人',
        show: '播客',
        liked: '歌单',
        song: '歌曲',
      },
      songCount: (count) => `${count} 首歌曲`,
      length: (seconds) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分 ${Math.floor(seconds % 60)} 秒`
      },
      recents: '最近播放',
      gridView: '网格视图',
      listView: '列表视图',
      verified: '已认证艺人',
      follow: '关注',
      following: '已关注',
      monthlyListeners: (count) => `${count} 位月度听众`,
      popular: '热门',
      discography: '作品集',
      playingFrom: {
        playlist: '正在从歌单播放',
        album: '正在从专辑播放',
        artist: '正在从艺人播放',
        show: '正在从播客播放',
        liked: '正在从你的音乐库播放',
      },
      nowPlaying: '正在播放',
      queue: '播放队列',
      nextFrom: (name) => `下一首来自：${name}`,
      nextUp: '接下来',
      lyrics: '歌词',
      noLyrics: '似乎没有这首歌的歌词。',
      notSynced: '这首歌的歌词尚未与歌曲同步。',
      lyricsFrom: (provider) => `歌词由 ${provider} 提供`,
      volume: '音量',
      mute: '静音',
      unmute: '取消静音',
      cantPlay: 'Spotify 暂时无法播放此内容。',
      failed: '出现问题',
      tryAgain: '重试',
      next: '下一首',
      previous: '上一首',
      shuffle: '随机播放',
      repeat: '循环播放',
      close: '关闭',
      more: '更多选项',
      download: '下载',
      addToLiked: '添加到“喜欢的歌曲”',
      addToLibrary: '添加到你的音乐库',
      added: '已添加到“喜欢的歌曲”。',
      removed: '已从“喜欢的歌曲”中移除。',
      addedToLibrary: '已添加到你的音乐库。',
      removedFromLibrary: '已从你的音乐库中移除。',
      logIn: '登录',
      signUp: '注册',
      logOut: '退出登录',
      account: '账户',
      previewTitle: 'Spotify 预览',
      previewText: '注册即可畅听无限歌曲和播客，偶尔会有广告。无需信用卡。',
      signUpFree: '免费注册',
      prompts: {
        play: { title: '用免费的 Spotify 账户开始收听', text: '' },
        save: { title: '保存到你的音乐库', text: '登录后即可保存歌曲、专辑、歌单和艺人。' },
        playlist: { title: '创建歌单', text: '登录后即可创建和分享歌单。' },
      },
      haveAccount: '已有账户？',
      notNow: '暂时不要',
      firstPlaylist: {
        title: '创建你的第一个歌单',
        text: '很简单，我们来帮你',
        button: '创建歌单',
      },
      firstPodcasts: {
        title: '来找些值得关注的播客吧',
        text: '我们会为你推送新节目',
        button: '浏览播客',
      },
      explicit: 'E',
    },
    appleMusic: {
      tabs: { home: '首页', new: '最新', radio: '广播', library: '资料库', search: '搜索' },
      searchHint: '艺人、歌曲、专辑及更多',
      browseCategories: '浏览分类',
      recentlySearched: '最近搜索',
      clear: '清除',
      topResults: '最佳结果',
      songs: '歌曲',
      artists: '艺人',
      albums: '专辑',
      playlists: '播放列表',
      stations: '电台',
      noResults: '无结果',
      noResultsHint: '试试新的搜索。',
      seeAll: '查看全部',
      recentlyPlayed: '最近播放',
      recentlyAdded: '最近添加',
      kinds: {
        album: '专辑',
        playlist: '播放列表',
        artist: '艺人',
        station: '电台',
        song: '歌曲',
        curator: '分类',
        folder: '文件夹',
      },
      length: (songs, seconds) => {
        const minutes = Math.round(seconds / 60)
        const count = `${songs} 首歌曲`
        if (minutes < 60) return `${count}，${minutes} 分钟`
        const hours = Math.floor(minutes / 60)
        const rest = minutes % 60
        return `${count}，${hours} 小时${rest ? ` ${rest} 分钟` : ''}`
      },
      topSongs: '热门歌曲',
      play: '播放',
      shuffle: '随机播放',
      live: '直播',
      explicit: '露骨内容',
      preview: '预览',
      upNext: '接下来',
      lyrics: '歌词',
      noLyrics: '此歌曲暂无歌词。',
      writtenBy: (names) => `词曲作者：${names}`,
      from: (name) => `来自 ${name}`,
      favorite: '收藏',
      favorited: '已添加到收藏',
      unfavorited: '已从收藏中移除',
      addToLibrary: '添加到资料库',
      added: '已添加到资料库',
      signIn: '登录',
      signOut: '退出登录',
      account: '账户',
      filter: '筛选',
      more: '更多',
      all: { playlists: '全部播放列表', albums: '全部专辑', songs: '全部歌曲' },
      favorites: '收藏',
      grid: '网格',
      list: '列表',
      find: '搜索',
      sorts: {
        name: '标题',
        '-dateAdded': '添加日期',
        '-lastPlayed': '上次播放日期',
        '-updated': '更新日期',
        type: '播放列表类型',
      },
      finishOnPc: '请在电脑上完成登录：Apple Music 的登录窗口已在你的桌面打开。',
      homePitch: {
        title: '从 Apple Music 获得更多',
        text: '登录后可查看为你精选的内容、最近播放以及你的资料库。',
      },
      libraryPitch: { title: '你的资料库', text: '登录即可查看你添加的音乐。' },
      promptTitle: '登录 Apple Music',
      promptFor: {
        library: '登录后即可将音乐添加到你的资料库。',
        favorite: '登录后即可收藏歌曲。',
      },
      notNow: '暂不',
      previewBanner: { title: '收听完整歌曲', text: '登录后即可播放每首完整歌曲，而不是试听片段。' },
      empty: '这里还没有内容。',
      cantPlay: 'Apple Music 暂时无法播放此内容。',
      failed: '加载失败。',
      tryAgain: '重试',
      back: '返回',
      close: '关闭',
      nowPlaying: '正在播放',
      next: '下一首',
      previous: '上一首',
      repeat: '循环播放',
      volume: '音量',
      mute: '静音',
      unmute: '取消静音',
    },
    youtubeMusic: {
      tabs: { home: '首页', explore: '探索', library: '媒体库', search: '搜索' },
      searchHint: '搜索歌曲、艺人、播客',
      remove: '移除',
      more: '更多',
      play: '播放',
      shuffle: '随机播放',
      radio: '电台',
      save: '保存到媒体库',
      saved: '已保存到媒体库',
      removed: '已从媒体库移除',
      inLibrary: '已保存',
      like: '喜欢',
      dislike: '不喜欢',
      song: '歌曲',
      video: '视频',
      upNext: '接下来',
      lyrics: '歌词',
      related: '相关',
      playingFrom: '播放来源',
      noLyrics: '此歌曲暂无歌词。',
      shelves: {
        playlists: '播放列表',
        songs: '歌曲',
        albums: '专辑',
        artists: '艺人',
        subscriptions: '订阅内容',
        history: '历史记录',
      },
      topResult: '最佳结果',
      subscribers: (count) => `${count} 位订阅者`,
      signIn: '登录',
      signOut: '退出登录',
      account: '账户',
      finishOnPc: '请在电脑上完成登录。',
      libraryPitch: {
        title: '畅享你喜爱的音乐',
        text: '登录后可查看你的播放列表、喜欢的歌曲和专辑。你的 YouTube 登录在这里同样有效。',
      },
      promptTitle: '登录 YouTube Music',
      promptFor: {
        library: '你的播放列表、歌曲和专辑都在媒体库中。',
        like: '你喜欢的歌曲会加入“喜欢的音乐”。',
        save: '你保存的专辑和播放列表会添加到媒体库。',
      },
      notNow: '暂不',
      empty: '这里还没有内容。',
      noResults: '无结果',
      cantPlay: 'YouTube Music 暂时无法播放此内容。',
      failed: '加载失败。',
      tryAgain: '重试',
      back: '返回',
      close: '关闭',
      nowPlaying: '正在播放',
      pause: '暂停',
      next: '下一首',
      previous: '上一首',
      repeat: '循环播放',
      ad: '广告',
      moreActions: '更多操作',
      startRadio: '开始电台',
      playNext: '下一首播放',
      addToQueue: '添加到队列',
      goToAlbum: '前往专辑',
      goToArtist: '前往艺人',
      willPlayNext: '将在下一首播放',
      addedToQueue: '已添加到播放队列',
      volume: '音量',
    },
    netease: {
      tabs: { home: '首页', search: '搜索', mine: '我的' },
      sources: { netease: '网易云', qq: 'QQ音乐', bilibili: '哔哩哔哩' },
      searchHint: '搜索歌曲、歌手、歌单',
      cancel: '取消',
      search: '搜索',
      searches: '搜索历史',
      remove: '删除',
      noResults: '没有结果',
      play: '播放',
      pause: '暂停',
      next: '下一首',
      previous: '上一首',
      shuffle: '随机播放',
      repeat: '循环播放',
      volume: '音量',
      lyrics: '歌词',
      nowPlaying: '正在播放',
      playingFrom: '播放来源',
      upNext: '接下来播放',
      kinds: { song: '单曲', playlist: '歌单', album: '专辑', artist: '歌手', radio: '电台' },
      songs: (count) => `${count} 首歌曲`,
      signIn: '登录',
      signOut: '退出登录',
      account: '账户',
      finishOnPc: '请在电脑上完成登录。',
      signInPitch: {
        title: '让音乐一直陪着你',
        text: '登录网易云音乐，即可查看你的歌单和喜欢的音乐。用网易云音乐自己的二维码，在手机上扫码登录。',
      },
      mineNote: '你的歌单和喜欢的音乐都在网易云音乐里，WestPlay 只显示其中能看到的部分。',
      empty: '这里还没有内容。',
      noLyrics: '此歌曲暂无歌词。',
      cantPlay: '网易云音乐暂时无法播放此内容。',
      failed: '加载失败。',
      tryAgain: '重试',
      back: '返回',
      close: '关闭',
    },
    weatherApp: {
      myLocation: '我的位置',
      nextChange: '下次天气变化',
      inAbout: (time) => `约 ${time}后`,
      roads: '路况',
      roadStates: { dry: '干燥', damp: '潮湿', wet: '湿滑' },
      roadTrends: { drying: '正在变干', gettingWet: '正在变湿' },
      unavailable: '游戏运行时才会显示天气。',
    },
    settings: {
      appearance: '外观',
      light: '浅色',
      dark: '深色',
      automatic: '自动',
      automaticFooter: '夜间以及打开前照灯时自动切换为深色，与卡车的灯光传感器一致。',
      vehicleBar: '车辆信息栏',
      vehicleBarFooter: 'WestPlay 旁的卡车信息栏。关闭后，WestPlay 将占满整个屏幕。',
      textSize: '文字大小',
      textSizeAbout: 'WestPlay 的应用程序会按你在下方选择的阅读大小自动调整。',
      wallpaper: '壁纸',
      dashboard: '仪表盘',
      widgets: '小组件',
      showAlbumArt: '显示专辑封面',
      sound: '声音',
      equalizer: '均衡器',
      recommended: '推荐',
      custom: '自定义',
      equalizerFooter:
        'WestPlay 通过每辆卡车自己的扬声器播放音乐，并针对其驾驶室进行调校。如果你更喜欢不同的音效，可以自定义每个音乐应用在每辆卡车中的声音。',
      low: '低频',
      mid: '中频',
      high: '高频',
      resetEqualizer: '重置',
      back: '返回',
    },
    apps: {
      maps: '地图',
      music: '音乐',
      spotify: 'Spotify',
      youtube: 'YouTube',
      youtubeMusic: 'YouTube Music',
      netease: '网易云音乐',
      podcasts: '播客',
      phone: '电话',
      messages: '信息',
      weather: '天气',
      settings: '设置',
    },
    notBuiltYet: '尚未构建',
  },
}

/** The cabin's language for the game's (its `g_lang_init`, e.g. `tr_tr` or `zh_cn`; `null` until known). */
export function languageOf(gameLanguage: string | null): Language {
  const language = gameLanguage?.toLowerCase()
  if (language?.startsWith('tr')) return 'tr'
  if (language?.startsWith('zh')) return 'zh'
  return 'en'
}
