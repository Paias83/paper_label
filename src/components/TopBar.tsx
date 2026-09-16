import { InstagramIcon } from './SocialIcons'

export default function TopBar() {
  return (
    <div className="top-bar">
      <div className="container top-bar-inner">
        <a
          href="https://www.instagram.com/studiopaper3d/"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
          className="top-bar-icon"
        >
          <InstagramIcon size={16} />
        </a>
      </div>
    </div>
  )
}
