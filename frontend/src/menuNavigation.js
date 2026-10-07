const item = (id, label, screen, subsection) => ({
  id,
  label,
  target: { screen },
  ...(subsection ? { subsection } : {})
});

export function buildMenuGroups(pillars, recommendations) {
  return [
    {
      title: "Evaluate",
      items: [
        item("start", "Analyze a Home", 0),
        item("listing", "Import a Listing", 11),
        item("property", "Property Details", 1),
        item("systems", "Key Systems", 2),
        item("all-systems", "All Home Specs", 14),
        item("review", "Review & Confirm", 3)
      ]
    },
    {
      title: "Results",
      items: [
        item("score", "VPSF Score Overview", 4),
        item("takeaways", "Key Takeaway", 5),
        item("recommendations", "Recommendations", 6),
        item("path", "Path to 700 VPSF", 17),
        item("cost", "Future Cost Exposure", 18),
        item("comparison", "Competing Home Comparison", 19),
        item("report", "VPSF Report Card", 9)
      ]
    },
    {
      title: "Explore",
      items: [
        ...pillars.map(({ key, label }) => ({ id: `pillar-${key}`, label, subsection: "Pillar Details", target: { screen: 10, pillar: key } })),
        ...pillars.map(({ key, label }) => ({ id: `archive-${key}`, label, subsection: "Know-How Archives", target: { screen: 22, pillar: key } })),
        ...recommendations.map(({ id, title }) => ({ id: `learn-${id}`, label: title, subsection: "Learn More", target: { screen: 21, recommendationId: id } }))
      ]
    },
    {
      title: "Products & Value",
      items: [
        item("categories", "Product Categories", 16),
        item("products", "Recommended Products", 7),
        item("marketing", "COGNITION Marketing Studio", 8)
      ]
    }
  ];
}
