import { Link } from 'react-router'
import { ACCOUNT_TYPE_LABELS, REVIEW_STATUS } from '../auth/constants.js'
import BusinessLicenseCard from '../auth/profile/BusinessLicenseCard.jsx'
import ProfileDetailsForm from '../auth/profile/ProfileDetailsForm.jsx'
import ServicesForm from '../auth/profile/ServicesForm.jsx'
import SkillsManager from '../auth/profile/SkillsManager.jsx'
import { pendingReviewItems } from '../auth/reviewItems.js'
import { useAuth } from '../auth/useAuth.js'
import { ROLES } from '../authorization/roles.js'
import { usePermission } from '../authorization/usePermission.js'
import Avatar from '../components/Avatar.jsx'
import Button from '../components/Button.jsx'
import Notice from '../components/Notice.jsx'
import PageShell from '../components/PageShell.jsx'
import SectionCard from '../components/SectionCard.jsx'
import SellingSettingsForm from '../features/marketplace/components/SellingSettingsForm.jsx'
import MyRequestsList from '../features/requests/components/MyRequestsList.jsx'
import styles from './ProfilePage.module.css'

// Each role's public page, where "View public profile" goes.
const PUBLIC_PATHS = {
  [ROLES.MECHANIC]: (id) => `/mechanics/${id}`,
  [ROLES.PARTS_SHOP]: (id) => `/shops/${id}`,
  [ROLES.TOW]: (id) => `/tow-companies/${id}`,
}

const NO_PUBLIC_PAGE = {
  [ROLES.CUSTOMER]:
    "Customers don't have a public page. Mechanics, shops and tow companies you contact see your name and photo.",
  [ROLES.ADMIN]: "Admins don't have a public page. Your name and photo appear in the admin area.",
}

// /profile - the public information others see about the logged-in user, for every role:
//   customer:    name, photo, city
//   mechanic:    photo, name, workshop, city, address, description, workshop photos, services, skills
//   parts shop:  logo, shop name, city, address, description, shop photos, selling settings,
//                business license
//   tow company: logo, company name, city, address, description, service area, business license,
//                and a link to /tow/trucks
//   admin:       name and photo
// Changed business names, licenses and certificates go to an admin first (profileService.js).
// Private settings (email, password, notifications) are on /account.
export default function ProfilePage() {
  const { user } = useAuth()
  const canSendRequests = usePermission('requests:part_question') // customers and mechanics
  const publicPath = PUBLIC_PATHS[user.role]?.(user.id)
  const waiting = pendingReviewItems(user)
  const rejectedCount =
    (user.skills ?? []).filter((s) => s.status === REVIEW_STATUS.REJECTED).length +
    (user.pendingChanges ?? []).filter((c) => c.status === REVIEW_STATUS.REJECTED).length

  return (
    <PageShell>
      <header className={styles.header}>
        <Avatar file={user.profilePhoto} name={user.name} size="lg" />
        <div className={styles.headerText}>
          <h1 className={styles.title}>Your profile</h1>
          <p className={styles.subtitle}>
            {user.name} · {ACCOUNT_TYPE_LABELS[user.role]}
          </p>
          <p className={styles.muted}>
            {publicPath ? 'This is what customers see on your public page.' : NO_PUBLIC_PAGE[user.role]} Email,
            phone and password are on <Link to="/account">your account page</Link>.
          </p>
        </div>
        {publicPath && (
          <Button to={publicPath} variant="secondary" className={styles.headerAction}>
            View public profile
          </Button>
        )}
      </header>

      {waiting.length > 0 && (
        <Notice tone="warning" title={`${waiting.length} ${waiting.length === 1 ? 'update is' : 'updates are'} waiting for MOTEXA review`}>
          {waiting.map((item) => item.label).join(', ')}. Your public profile keeps showing the approved information
          until then.
        </Notice>
      )}
      {rejectedCount > 0 && (
        <Notice tone="danger">
          MOTEXA didn't approve {rejectedCount === 1 ? 'one of your updates' : `${rejectedCount} of your updates`}.
          The reason is shown next to {rejectedCount === 1 ? 'it' : 'each one'} below.
        </Notice>
      )}

      <SectionCard
        title="Public details"
        description={
          user.role === ROLES.CUSTOMER || user.role === ROLES.ADMIN
            ? undefined
            : 'Photos, descriptions and addresses are saved right away. A new business or workshop name is checked by MOTEXA first.'
        }
      >
        <ProfileDetailsForm />
      </SectionCard>

      {user.role === ROLES.MECHANIC && (
        <>
          <SectionCard
            title="Services I offer"
            description="Customers choose one of these when they request service from you."
          >
            <ServicesForm />
          </SectionCard>
          <SectionCard
            title="Skills"
            description="Each skill needs a certificate. New skills and new certificates are checked by MOTEXA; only approved skills are public."
          >
            <SkillsManager />
          </SectionCard>
        </>
      )}

      {user.role === ROLES.PARTS_SHOP && (
        <SectionCard
          title="Selling settings"
          description="How customers can buy your parts: delivery, pickup and the payment methods you accept. Saved right away."
        >
          <SellingSettingsForm />
        </SectionCard>
      )}

      {(user.role === ROLES.PARTS_SHOP || user.role === ROLES.TOW) && (
        <SectionCard title="Business license" description="Only MOTEXA admins see your license - it is never public.">
          <BusinessLicenseCard />
        </SectionCard>
      )}

      {user.role === ROLES.TOW && (
        <SectionCard
          title="Trucks"
          description={`${user.trucks.length} ${user.trucks.length === 1 ? 'truck' : 'trucks'} in your fleet. Add, edit or remove trucks and set their status.`}
          action={
            <Button to="/tow/trucks" variant="secondary">
              Manage trucks
            </Button>
          }
        />
      )}

      {canSendRequests && (
        <SectionCard title="Your requests" description="Only you see this list.">
          <MyRequestsList />
        </SectionCard>
      )}
    </PageShell>
  )
}
