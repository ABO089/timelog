export default function ProjectBadge({ color = '#0070F2', name, shortcode }) {
  return (
    <span className="badge" style={{ background: color }}>
      {shortcode || name}
    </span>
  )
}
