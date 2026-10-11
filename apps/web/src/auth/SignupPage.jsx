import { Link, Navigate, useSearchParams } from 'react-router'
import { ACCOUNT_TYPE_LABELS, ROLES_NEEDING_APPROVAL, SIGNUP_ROLES } from './constants.js'
import { landingPathFor } from './landingPath.js'
import { useAuth } from './useAuth.js'
import AuthCard from './AuthCard.jsx'
import RoleChoice from './signup/RoleChoice.jsx'
import SignupWizard from './signup/SignupWizard.jsx'

// /signup - choose an account type, then fill in that role's steps.
// The chosen role is in the URL (/signup?role=mechanic), so pages can link straight to a role.
export default function SignupPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const roleParam = searchParams.get('role')
  const role = SIGNUP_ROLES.includes(roleParam) ? roleParam : null

  // Logged in already, or the account was just created.
  if (user) return <Navigate to={landingPathFor(user)} replace />

  let subtitle = 'Choose the account type that fits you.'
  if (role) {
    subtitle = ROLES_NEEDING_APPROVAL.includes(role)
      ? 'Fill in each step. An admin checks your documents before your account is activated.'
      : 'It only takes a minute.'
  }

  return (
    <AuthCard
      wide
      title={role ? `Sign up as ${ACCOUNT_TYPE_LABELS[role]}` : 'Create your MOTEXA account'}
      subtitle={subtitle}
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      {role ? (
        // key: switching role starts a fresh form
        <SignupWizard key={role} role={role} onChangeRole={() => setSearchParams({})} />
      ) : (
        <RoleChoice onChoose={(chosen) => setSearchParams({ role: chosen })} />
      )}
    </AuthCard>
  )
}
