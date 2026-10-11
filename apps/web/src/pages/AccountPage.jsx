import { Link } from 'react-router'
import ChangePasswordForm from '../auth/account/ChangePasswordForm.jsx'
import ContactForm from '../auth/account/ContactForm.jsx'
import LogoutEverywhere from '../auth/account/LogoutEverywhere.jsx'
import NotificationSettings from '../auth/account/NotificationSettings.jsx'
import { ACCOUNT_STATUS, ACCOUNT_TYPE_LABELS, accountStatusBadge } from '../auth/constants.js'
import { useAuth } from '../auth/useAuth.js'
import ThemeToggle from '../components/Layout/ThemeToggle.jsx'
import Notice from '../components/Notice.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PageShell from '../components/PageShell.jsx'
import SectionCard from '../components/SectionCard.jsx'
import StatusIndicator from '../components/StatusIndicator.jsx'
import styles from './AccountPage.module.css'

// /account - private account and security settings, for every role (pending and rejected accounts
// too): email and phone, password, log out everywhere, theme and email notifications.
// What others see is on /profile.
export default function AccountPage() {
  const { user } = useAuth()
  const status = accountStatusBadge(user)
  const approved = user.status === ACCOUNT_STATUS.APPROVED

  return (
    <PageShell>
      <PageHeader
        title="Account"
        description={
          <>
            Private settings - only you see these.
            {approved && (
              <>
                {' '}
                What others see is on <Link to="/profile">your profile</Link>.
              </>
            )}
          </>
        }
      />

      {!approved && (
        <Notice tone={user.status === ACCOUNT_STATUS.REJECTED ? 'danger' : 'warning'}>
          Your account isn't approved yet, so your profile and dashboard are not available.{' '}
          <Link to="/pending-approval">See your account status</Link>.
        </Notice>
      )}

      <SectionCard title="Account details" description="Your email and phone are never shown on public pages.">
        <dl className={styles.facts}>
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>{ACCOUNT_TYPE_LABELS[user.role]}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusIndicator label={status.label} tone={status.tone} />
            </dd>
          </div>
        </dl>
        <ContactForm />
      </SectionCard>

      <SectionCard title="Password" description="At least 8 characters, with at least one letter and one number.">
        <ChangePasswordForm />
      </SectionCard>

      <SectionCard title="Settings">
        <div className={styles.settings}>
          <ThemeToggle variant="segmented" className={styles.theme} />
          <NotificationSettings />
        </div>
      </SectionCard>

      <SectionCard title="Sessions">
        <LogoutEverywhere />
      </SectionCard>
    </PageShell>
  )
}
