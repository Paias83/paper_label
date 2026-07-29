import { InstagramIcon, TikTokIcon } from './SocialIcons'

export default function TopBar() {
  return (
    <div className="top-bar">
      <div className="container top-bar-inner">
        <a
          href="#"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
          className="top-bar-icon"
        >
          <InstagramIcon size={16} />
        </a>
        <a
          href="#"
          target="_blank"
          rel="noreferrer"
          aria-label="TikTok"
          className="top-bar-icon"
        >
          <TikTokIcon size={16} />
        </a>
      </div>
    </div>
  )
}
