import PageIntro from '../../../components/PageIntro.jsx'
import PageShell from '../../../components/PageShell.jsx'

// Every admin page: the shared page shell and the intro (OPERATIONS / SECTION kicker, title,
// description, main action), then the content.
export default function AdminPage({ title, description, actions, eyebrow = `Operations / ${title}`, children }) {
  return (
    <PageShell>
      <PageIntro eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {children}
    </PageShell>
  )
}
