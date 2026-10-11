import Drawer from './Drawer.jsx'

// The right-side panel for quick inspection of a row (about 520px). Full pages stay for long work.
export default function DetailDrawer({ open, title, onClose, children }) {
  return (
    <Drawer open={open} narrow title={title} onClose={onClose}>
      {children}
    </Drawer>
  )
}