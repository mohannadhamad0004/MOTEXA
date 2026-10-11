import { createBrowserRouter, Navigate } from 'react-router'
import ForgotPasswordPage from '../auth/ForgotPasswordPage.jsx'
import LoginPage from '../auth/LoginPage.jsx'
import PendingApprovalPage from '../auth/PendingApprovalPage.jsx'
import ResetPasswordPage from '../auth/ResetPasswordPage.jsx'
import SignupPage from '../auth/SignupPage.jsx'
import ProtectedRoute from '../authorization/ProtectedRoute.jsx'
import { ROLES } from '../authorization/roles.js'
import Layout from '../components/Layout/Layout.jsx'
import AdminLayout from '../features/admin/components/AdminLayout.jsx'
import AdminApprovals from '../features/admin/pages/AdminApprovals.jsx'
import AdminListingDetails from '../features/admin/pages/AdminListingDetails.jsx'
import AdminListings from '../features/admin/pages/AdminListings.jsx'
import AdminOrderDetails from '../features/admin/pages/AdminOrderDetails.jsx'
import AdminOrders from '../features/admin/pages/AdminOrders.jsx'
import AdminOverview from '../features/admin/pages/AdminOverview.jsx'
import AdminRequests from '../features/admin/pages/AdminRequests.jsx'
import AdminReviews from '../features/admin/pages/AdminReviews.jsx'
import CarDetailsPage from '../features/cars/pages/CarDetailsPage.jsx'
import MyCarsPage from '../features/cars/pages/MyCarsPage.jsx'
import DiagnosePage from '../features/diagnosis/pages/DiagnosePage.jsx'
import AiAgentPage from '../features/diagnosis/pages/AiAgentPage.jsx'
import DiagnosisReportPage from '../features/diagnosis/pages/DiagnosisReportPage.jsx'
import AdminTags from '../features/admin/pages/AdminTags.jsx'
import AdminUserDetails from '../features/admin/pages/AdminUserDetails.jsx'
import AdminUsers from '../features/admin/pages/AdminUsers.jsx'
import TowCompaniesDirectory from '../features/logistics/pages/TowCompaniesDirectory.jsx'
import TowCompaniesMap from '../features/logistics/pages/TowCompaniesMap.jsx'
import TowCompanyProfile from '../features/logistics/pages/TowCompanyProfile.jsx'
import TowTrucks from '../features/logistics/pages/TowTrucks.jsx'
import DevImagesPage from '../features/marketplace/pages/DevImagesPage.jsx'
import CartPage from '../features/marketplace/pages/CartPage.jsx'
import CheckoutConfirmationPage from '../features/marketplace/pages/CheckoutConfirmationPage.jsx'
import CheckoutPage from '../features/marketplace/pages/CheckoutPage.jsx'
import OrderDetailsPage from '../features/marketplace/pages/OrderDetailsPage.jsx'
import OrdersPage from '../features/marketplace/pages/OrdersPage.jsx'
import PackingSlipPage from '../features/marketplace/pages/PackingSlipPage.jsx'
import CategoryPage from '../features/marketplace/pages/CategoryPage.jsx'
import GroupPage from '../features/marketplace/pages/GroupPage.jsx'
import MarketplaceHome from '../features/marketplace/pages/MarketplaceHome.jsx'
import MarketplaceLayout from '../features/marketplace/pages/MarketplaceLayout.jsx'
import OldPartLink from '../features/marketplace/pages/OldPartLink.jsx'
import PartDetailsPage from '../features/marketplace/pages/PartDetailsPage.jsx'
import SearchResultsPage from '../features/marketplace/pages/SearchResultsPage.jsx'
import SavedPartsPage from '../features/marketplace/pages/SavedPartsPage.jsx'
import ShopOrderDetailsPage from '../features/marketplace/pages/ShopOrderDetailsPage.jsx'
import ShopOrdersPage from '../features/marketplace/pages/ShopOrdersPage.jsx'
import MechanicProfile from '../features/mechanics/pages/MechanicProfile.jsx'
import MechanicsDirectory from '../features/mechanics/pages/MechanicsDirectory.jsx'
import MechanicsMap from '../features/mechanics/pages/MechanicsMap.jsx'
import ChatsPage from '../features/requests/pages/ChatsPage.jsx'
import ReportPage from '../features/requests/pages/ReportPage.jsx'
import ReportsPage from '../features/requests/pages/ReportsPage.jsx'
import AccountPage from '../pages/AccountPage.jsx'
import Home from '../pages/Home.jsx'
import MechanicDashboard from '../pages/MechanicDashboard.jsx'
import PartsShopDashboard from '../pages/PartsShopDashboard.jsx'
import ProfilePage from '../pages/ProfilePage.jsx'
import ShopPage from '../pages/ShopPage.jsx'
import TowDashboard from '../pages/TowDashboard.jsx'

// Every page renders inside Layout (navbar + page wrapper).
// Public pages need no login. Dashboards sit behind ProtectedRoute: only approved accounts of
// that role can open them. Customers have no dashboard - after login they go to "/".
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/diagnose', element: <DiagnosePage /> },

      // Public: anyone can browse; sending a request asks for login first
      // Marketplace: home, search, part pages, then groups and categories (MarketplaceLayout holds
      // the vehicle drawer and the 3D preview for all of them).
      {
        path: '/marketplace',
        element: <MarketplaceLayout />,
        children: [
          { index: true, element: <MarketplaceHome /> },
          { path: 'search', element: <SearchResultsPage /> },
          { path: 'part/:partId', element: <PartDetailsPage /> },
          { path: 'parts/:partId', element: <OldPartLink /> },
          { path: ':group', element: <GroupPage /> },
          { path: ':group/:category', element: <CategoryPage /> },
        ],
      },
      { path: '/shops/:shopId', element: <ShopPage /> },
      { path: '/mechanics', element: <MechanicsDirectory /> },
      { path: '/mechanics/map', element: <MechanicsMap /> },
      { path: '/mechanics/:mechanicId', element: <MechanicProfile /> },
      { path: '/tow-companies', element: <TowCompaniesDirectory /> },
      { path: '/tow-companies/map', element: <TowCompaniesMap /> },
      { path: '/tow-companies/:companyId', element: <TowCompanyProfile /> },

      // Development only: left out of production builds
  ...(import.meta.env.DEV ? [{ path: '/dev/images', element: <DevImagesPage /> }] : []),

  // Auth
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/pending-approval', element: <PendingApprovalPage /> },

      // Any logged-in user, also while pending or rejected: email, phone, password, settings
      {
        element: <ProtectedRoute allowUnapproved />,
        children: [{ path: '/account', element: <AccountPage /> }],
      },
      // The old settings page is part of /account now
      { path: '/settings', element: <Navigate to="/account" replace /> },

      // Any logged-in, approved user: their public profile
      {
        element: <ProtectedRoute />,
        children: [{ path: '/profile', element: <ProfilePage /> }],
      },

      // Customers: their cars, AI diagnoses and the reports of completed requests
      {
        element: <ProtectedRoute roles={[ROLES.CUSTOMER]} />,
        children: [
          { path: '/my-cars', element: <MyCarsPage /> },
          { path: '/my-cars/:carId', element: <CarDetailsPage /> },
          { path: '/ai-agent', element: <AiAgentPage /> },
          { path: '/ai-agent/:diagnosisId', element: <DiagnosisReportPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/reports/:requestId', element: <ReportPage /> },
        ],
      },

      // Buying parts: customers and mechanics. Visitors who press Add to cart are sent to log in first.
      {
        element: <ProtectedRoute roles={[ROLES.CUSTOMER, ROLES.MECHANIC]} />,
        children: [
          { path: '/cart', element: <CartPage /> },
          { path: '/saved-parts', element: <SavedPartsPage /> },
          { path: '/checkout', element: <CheckoutPage /> },
          { path: '/checkout/confirmation/:checkoutId', element: <CheckoutConfirmationPage /> },
          { path: '/orders', element: <OrdersPage /> },
          { path: '/orders/:orderId', element: <OrderDetailsPage /> },
        ],
      },

      // Chats: everyone who sends or receives requests
      {
        element: <ProtectedRoute roles={[ROLES.CUSTOMER, ROLES.MECHANIC, ROLES.PARTS_SHOP, ROLES.TOW]} />,
        children: [
          { path: '/chats', element: <ChatsPage /> },
          { path: '/chats/:requestId', element: <ChatsPage /> },
        ],
      },

      // Dashboards, one per role (not customers)
      {
        element: <ProtectedRoute roles={[ROLES.MECHANIC]} />,
        children: [{ path: '/mechanic', element: <MechanicDashboard /> }],
      },
      {
        element: <ProtectedRoute roles={[ROLES.PARTS_SHOP]} />,
        children: [
          { path: '/parts-shop', element: <PartsShopDashboard /> },
          { path: '/parts-shop/orders', element: <ShopOrdersPage /> },
          { path: '/parts-shop/orders/:orderId', element: <ShopOrderDetailsPage /> },
          { path: '/parts-shop/orders/:orderId/packing-slip', element: <PackingSlipPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={[ROLES.TOW]} />,
        children: [
          { path: '/tow', element: <TowDashboard /> },
          { path: '/tow/trucks', element: <TowTrucks /> },
        ],
      },

      // Admin area: admins only, sidebar layout
      {
        element: <ProtectedRoute roles={[ROLES.ADMIN]} />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminOverview /> },
              { path: 'approvals', element: <AdminApprovals /> },
              { path: 'users', element: <AdminUsers /> },
              { path: 'users/:userId', element: <AdminUserDetails /> },
              { path: 'tags', element: <AdminTags /> },
              { path: 'listings', element: <AdminListings /> },
              { path: 'listings/:partId', element: <AdminListingDetails /> },
              { path: 'reviews', element: <AdminReviews /> },
              { path: 'requests', element: <AdminRequests /> },
              { path: 'orders', element: <AdminOrders /> },
              { path: 'orders/:orderId', element: <AdminOrderDetails /> },
            ],
          },
        ],
      },
    ],
  },
])
