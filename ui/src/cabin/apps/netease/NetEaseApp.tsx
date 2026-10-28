import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useKeyboard } from '../../keyboard/store'
import { TextField } from '../../keyboard/TextField'
import { useText } from '../../state/text'
import { BackGlyph, MarkGlyph, NoteCloudGlyph, PersonGlyph, SearchGlyph } from './glyphs'
import { MiniPlayer, NowPlaying } from './NowPlaying'
import { Home, Mine, Page, Search, Typing } from './pages'
import {
  type Tab,
  TABS,
  goBack,
  openTab,
  setSource,
  openView,
  remember,
  showToast,
  useAccount,
  useNetease,
  useSongsEnd,
  useWebPlayer,
} from './netease'
import './netease.css'

const FIELD = 'netease-search'

/**
 * NetEase Cloud Music: WestPlay's own app in the look of NetEase Cloud Music's app, sized for the cab. On top, its
 * mark, the search (or the field, on Search) and the account; under it the page, each tab's kept where it was
 * left; at the foot the mini player over the tabs (Home, Search, Mine); pressed, Now Playing rises over all.
 *
 * TODO(verify): NetEase's own app, on a phone: its top bar and its tabs' order and words (Home, Search, Mine),
 * its Now Playing's layout, and the colours and type below (netease.css) are drawn from memory for the cab.
 */
export function NetEaseApp() {
  const text = useText()
  const source = useNetease((state) => state.source)
  const tab = useNetease((state) => state.tab)
  const views = useNetease((state) => state.views)
  const account = useAccount()
  const signingIn = useNetease((state) => state.signingIn)
  const nowPlaying = useNetease((state) => state.nowPlaying)
  const [query, setQuery] = useState('')
  // The tab Search was opened from: closing Search goes back to it.
  const [before, setBefore] = useState<Tab>('home')
  const typing = useKeyboard((state) => state.field?.id === FIELD)
  useWebPlayer()
  useSongsEnd()
  // A play NetEase didn't confirm: said.
  const unplayed = useNetease((state) => state.unplayed)
  useEffect(() => {
    if (unplayed > 0) showToast(text.netease.cantPlay)
  }, [unplayed, text])
  useEffect(() => {
    if (typing) useNetease.setState({ tab: 'search' })
  }, [typing])

  // The keyboard put away by the player while words are typed (its own hide key): what they'd find stays, as a
  // page of results; put away by the app (a search made, a tab), nothing more.
  const leaving = useRef(false)
  const wasTyping = useRef(typing)
  useEffect(() => {
    const put = wasTyping.current && !typing
    wasTyping.current = typing
    if (!put) return
    const deliberate = leaving.current
    leaving.current = false
    const wanted = query.trim()
    if (deliberate || !wanted) return
    const { views: now } = useNetease.getState()
    const top = now.search[now.search.length - 1]
    if (top?.kind === 'results' && top.query === wanted) return
    openView({ kind: 'results', query: wanted })
    // Only as the keyboard goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing])

  const stopTyping = () => {
    if (useKeyboard.getState().field?.id === FIELD) leaving.current = true
    useKeyboard.getState().detach(FIELD)
  }
  const search = (wanted: string) => {
    const trimmed = wanted.trim()
    if (!trimmed) return
    setQuery(trimmed)
    stopTyping()
    remember(trimmed)
    useNetease.setState({ tab: 'search' })
    openView({ kind: 'results', query: trimmed })
  }
  const go = (to: Tab) => {
    stopTyping()
    if (to === 'search' && tab !== 'search') setBefore(tab)
    openTab(to)
  }
  const closeSearch = () => {
    stopTyping()
    setQuery('')
    openTab(before)
  }
  const searching = tab === 'search'
  const pages = views[tab]
  const words = text.netease

  return (
    <section className="app-panel ne-app" aria-label={text.apps.netease}>
      <header className="ne-top-bar">
        {searching ? (
          <button
            type="button"
            className="ne-round"
            aria-label={words.back}
            onClick={pages.length && !typing ? goBack : closeSearch}
          >
            <BackGlyph size={30} />
          </button>
        ) : (
          <span className="ne-brand" aria-hidden>
            <MarkGlyph size={36} />
            <b>{words.sources[source]}</b>
          </span>
        )}
        {!searching && (
          <span className="ne-sources">
            <button
              type="button"
              className={source === 'netease' ? 'ne-pill on' : 'ne-pill'}
              onClick={() => setSource('netease')}
            >
              {words.sources.netease}
            </button>
            <button type="button" className={source === 'qq' ? 'ne-pill on' : 'ne-pill'} onClick={() => setSource('qq')}>
              {words.sources.qq}
            </button>
            <button
              type="button"
              className={source === 'bilibili' ? 'ne-pill on' : 'ne-pill'}
              onClick={() => setSource('bilibili')}
            >
              {words.sources.bilibili}
            </button>
          </span>
        )}
        {searching ? (
          <div className="ne-search">
            <TextField
              id={FIELD}
              value={query}
              onChange={setQuery}
              onSubmit={() => search(query)}
              returnKind="search"
              hint={words.searchHint}
              label={words.search}
              icon={<SearchGlyph size={28} />}
            />
          </div>
        ) : (
          <span className="ne-top-gap" />
        )}
        {searching ? (
          <button type="button" className="ne-pill outline" onClick={closeSearch}>
            {words.cancel}
          </button>
        ) : (
          <button type="button" className="ne-round" aria-label={words.search} onClick={() => go('search')}>
            <SearchGlyph size={32} />
          </button>
        )}
        {!searching && account !== 'in' && (
          <button
            type="button"
            className={tab === 'mine' ? 'ne-round on' : 'ne-round'}
            aria-label={words.account}
            aria-pressed={tab === 'mine'}
            onClick={() => go('mine')}
          >
            <PersonGlyph size={30} filled={tab === 'mine'} />
          </button>
        )}
      </header>
      {/* Layers, each kept as it is under the one over it (a tab left, or a page gone back from, is found as it
          was, its scroll and all): each tab's own page, the pages over it, then what's typed. */}
      <div className="ne-body">
        {TABS.map((each) => (
          <TabLayers key={each} tab={each} shown={each === tab && !typing} onSearch={search} />
        ))}
        {typing && (
          <Layer shown opened={false}>
            <Typing query={query} onSearch={search} />
          </Layer>
        )}
      </div>
      {signingIn && !typing && <p className="ne-signing-in">{words.finishOnPc}</p>}
      {/* Not under Now Playing (it's there, larger). */}
      {!typing && !nowPlaying && <MiniPlayer />}
      {!typing && (
        <nav className="ne-tabs">
          {TABS.map((each) => {
            const on = each === tab || (each === before && tab === 'search')
            return (
              <button
                key={each}
                type="button"
                className={each === tab ? 'ne-tab on' : 'ne-tab'}
                aria-pressed={each === tab}
                onClick={() => go(each)}
              >
                <TabGlyph tab={each} on={on && each === tab} />
                <span>{words.tabs[each]}</span>
              </button>
            )
          })}
        </nav>
      )}
      <Toast />
      <NowPlaying />
    </section>
  )
}

function TabGlyph({ tab, on }: { tab: Tab; on: boolean }) {
  if (tab === 'home') return <NoteCloudGlyph size={30} filled={on} />
  if (tab === 'search') return <SearchGlyph size={30} />
  return <PersonGlyph size={30} filled={on} />
}

function TabLayers({ tab, shown, onSearch }: { tab: Tab; shown: boolean; onSearch(query: string): void }) {
  const views = useNetease((state) => state.views[tab])
  return (
    <>
      <Layer shown={shown && views.length === 0} opened={false}>
        <TabPage tab={tab} shown={shown && views.length === 0} onSearch={onSearch} />
      </Layer>
      {views.map((view, index) => (
        <Layer key={view.id} shown={shown && index === views.length - 1} opened>
          <Page view={view} />
        </Layer>
      ))}
    </>
  )
}

function TabPage({ tab, shown, onSearch }: { tab: Tab; shown: boolean; onSearch(query: string): void }) {
  switch (tab) {
    case 'home':
      return <Home shown={shown} />
    case 'search':
      return <Search onSearch={onSearch} />
    case 'mine':
      return <Mine shown={shown} />
  }
}

/** A layer: a page just opened comes in from the side; one shown again (Back, a tab chosen again) only fades
 * up, where it was. */
function Layer({ shown, opened, children }: { shown: boolean; opened: boolean; children: ReactNode }) {
  const [fresh, setFresh] = useState(opened)
  const className = !shown ? 'ne-layer away' : fresh ? 'ne-layer fresh' : 'ne-layer'
  return (
    <div className={className} onAnimationEnd={(event) => event.target === event.currentTarget && setFresh(false)}>
      {children}
    </div>
  )
}

/** "NetEase can't play this right now.": a moment over the mini player. */
function Toast() {
  const toast = useNetease((state) => state.toast)
  return toast ? (
    <p key={toast.id} className="ne-toast" role="status">
      {toast.text}
    </p>
  ) : null
}
