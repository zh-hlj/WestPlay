import { type ReactNode, useEffect } from 'react'
import { useText } from '../../state/text'
import { CloseGlyph, HistoryGlyph, PlayGlyph, SearchGlyph } from './glyphs'
import { Cover, Failed, PageBody, Shelf, Skeletons, SongList } from './parts'
import {
  type NeteaseAnswers,
  type NeteaseCollection,
  type NeteaseItem,
  type NeteaseResults,
  type View,
  forget,
  playCollection,
  playSong,
  remember,
  signIn,
  signOut,
  useAccount,
  useAsked,
  useNetease,
  useShownAgain,
} from './netease'

/** A question's answer as a page: its shapes while it comes, Failed (and Try again) if it doesn't. */
function Answered<A>({
  asked,
  rows,
  children,
}: {
  asked: { answer: A | null; failed: boolean; retry(): void }
  rows?: boolean
  children(answer: A): ReactNode
}) {
  if (asked.answer) return <>{children(asked.answer)}</>
  if (asked.failed) return <Failed onRetry={asked.retry} />
  return <Skeletons rows={rows} />
}

// --- The tabs' own pages -------------------------------------------------------------------------------------

/** Home: NetEase Cloud Music's recommendation shelves. */
export function Home({ shown }: { shown: boolean }) {
  const asked = useAsked({ ask: 'home' }, useShownAgain(shown))
  return (
    <PageBody>
      <Answered asked={asked}>
        {(answer: NeteaseAnswers['home']) =>
          answer.sections.length > 0 ? (
            answer.sections.map((section, index) => <Shelf key={`${section.title}-${index}`} section={section} />)
          ) : (
            <Empty />
          )
        }
      </Answered>
    </PageBody>
  )
}

/** Search, before anything's typed: the searches made, newest first. */
export function Search({ onSearch }: { onSearch(query: string): void }) {
  const text = useText()
  const searches = useNetease((state) => state.searches)
  return (
    <PageBody>
      <div className="ne-history">
        <h2>{text.netease.searches}</h2>
        {searches.length === 0 && <p className="ne-note">{text.netease.empty}</p>}
        {searches.map((query) => (
          <div key={query} className="ne-history-row">
            <button type="button" className="ne-history-words" onClick={() => onSearch(query)}>
              <HistoryGlyph size={26} />
              <span>{query}</span>
            </button>
            <button
              type="button"
              className="ne-round small"
              aria-label={text.netease.remove}
              onClick={() => forget(query)}
            >
              <CloseGlyph size={22} />
            </button>
          </div>
        ))}
      </div>
    </PageBody>
  )
}

/** What's typed so far: NetEase's words for it, and the searches made that start with them. */
export function Typing({ query, onSearch }: { query: string; onSearch(query: string): void }) {
  const text = useText()
  const searches = useNetease((state) => state.searches)
  const wanted = query.trim()
  const found = wanted ? searches.filter((each) => each.toLowerCase().includes(wanted.toLowerCase())) : searches
  return (
    <PageBody>
      <div className="ne-history">
        <h2>{wanted ? text.netease.search : text.netease.searches}</h2>
        {wanted && (
          <button type="button" className="ne-history-row ne-search-row" onClick={() => onSearch(wanted)}>
            <SearchGlyph size={26} />
            <span>{wanted}</span>
          </button>
        )}
        {found.map((each) => (
          <button key={each} type="button" className="ne-history-row ne-search-row" onClick={() => onSearch(each)}>
            <HistoryGlyph size={26} />
            <span>{each}</span>
          </button>
        ))}
      </div>
    </PageBody>
  )
}

/** A search's results: its songs, then its playlists, albums and artists. */
function Results({ query }: { query: string }) {
  const text = useText()
  const asked = useAsked({ ask: 'search', query })
  useEffect(() => remember(query), [query])
  const words = text.netease
  return (
    <PageBody>
      <h1 className="ne-page-title">{query}</h1>
      <Answered asked={asked} rows>
        {(answer: NeteaseResults) => {
          const empty =
            answer.songs.length === 0 &&
            answer.playlists.length === 0 &&
            answer.albums.length === 0 &&
            answer.artists.length === 0
          return empty ? (
            <p className="ne-note">{words.noResults}</p>
          ) : (
            <>
              {answer.songs.length > 0 && (
                <section className="ne-shelf">
                  <header className="ne-shelf-head">
                    <h2>{words.kinds.song}</h2>
                  </header>
                  <SongList tracks={answer.songs} />
                </section>
              )}
              {answer.playlists.length > 0 && (
                <Shelf section={{ title: words.kinds.playlist, items: answer.playlists }} />
              )}
              {answer.albums.length > 0 && <Shelf section={{ title: words.kinds.album, items: answer.albums }} />}
              {answer.artists.length > 0 && <Shelf section={{ title: words.kinds.artist, items: answer.artists }} />}
            </>
          )
        }}
      </Answered>
    </PageBody>
  )
}

/** A playlist's or an album's page: its cover and what it is beside its songs. */
function CollectionPage({ item }: { item: NeteaseItem }) {
  const text = useText()
  const asked = useAsked({ ask: 'collection', id: item.id })
  const found: NeteaseCollection | null = asked.answer
  const words = text.netease
  const shown = found?.item ?? item
  return (
    <PageBody>
      <section className="ne-collection">
        <header className="ne-collection-head">
          <Cover name={shown.name} kind={shown.kind} image={shown.image} className="ne-collection-cover" />
          <div className="ne-collection-text">
            <span className="ne-collection-kind">{words.kinds[shown.kind]}</span>
            <h1>{shown.name}</h1>
            {shown.by && <span className="ne-collection-by">{shown.by}</span>}
            {found && <span className="ne-collection-line">{words.songs(found.tracks.length)}</span>}
            {shown.description && <p className="ne-collection-words">{shown.description}</p>}
            {found && found.tracks.length > 0 && (
              <button type="button" className="ne-pill red" onClick={() => playCollection(shown, found.tracks)}>
                <PlayGlyph size={24} />
                {words.play}
              </button>
            )}
          </div>
        </header>
        <Answered asked={asked} rows>
          {(answer: NeteaseCollection) =>
            answer.tracks.length > 0 ? (
              <SongList
                tracks={answer.tracks}
                onPlay={(track) =>
                  playSong(track, answer.item.id, {
                    id: answer.item.id,
                    name: answer.item.name,
                    kind: answer.item.kind,
                  })
                }
              />
            ) : (
              <p className="ne-note">{words.empty}</p>
            )
          }
        </Answered>
      </section>
    </PageBody>
  )
}

/** Mine: the account, signed in or out (NetEase's sign-in is its own: a QR code in a window on the PC). */
export function Mine() {
  const text = useText()
  const account = useAccount()
  const signingIn = useNetease((state) => state.signingIn)
  const words = text.netease
  if (account === 'in') {
    return (
      <PageBody>
        <section className="ne-mine">
          <div className="ne-mine-head">
            <span className="ne-mine-avatar" aria-hidden>
              ♪
            </span>
            <div className="ne-mine-text">
              <h1>{words.account}</h1>
              <p>{words.mineNote}</p>
            </div>
          </div>
          <button type="button" className="ne-pill outline" onClick={() => signOut()}>
            {words.signOut}
          </button>
        </section>
      </PageBody>
    )
  }
  return (
    <PageBody>
      {account === 'out' && (
        <section className="ne-mine ne-pitch">
          <h2>{words.signInPitch.title}</h2>
          <p>{words.signInPitch.text}</p>
          <button type="button" className="ne-pill red" onClick={signIn} disabled={signingIn}>
            {words.signIn}
          </button>
          {signingIn && <p className="ne-note">{words.finishOnPc}</p>}
        </section>
      )}
    </PageBody>
  )
}

function Empty() {
  const text = useText()
  return <p className="ne-note">{text.netease.empty}</p>
}

export function Page({ view }: { view: View }) {
  switch (view.kind) {
    case 'collection':
      return <CollectionPage item={view.item} />
    case 'results':
      return <Results query={view.query} />
  }
}
