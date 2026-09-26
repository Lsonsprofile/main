const COMPONENT_REGISTRY = {
  heading: { label: 'Heading', category: 'text', canHaveChildren: false },
  text: { label: 'Rich Text', category: 'text', canHaveChildren: false },
  image: { label: 'Image', category: 'media', canHaveChildren: false },
  video: { label: 'Video', category: 'media', canHaveChildren: false },
  link: { label: 'Link', category: 'text', canHaveChildren: false },
  button: { label: 'Button', category: 'interface', canHaveChildren: false },
  search: { label: 'Page Search', category: 'interface', canHaveChildren: false },
  list: { label: 'List', category: 'text', canHaveChildren: false },
  code: { label: 'Code Block', category: 'learning', canHaveChildren: false },
  quote: { label: 'Quote', category: 'text', canHaveChildren: false },
  divider: { label: 'Divider', category: 'layout', canHaveChildren: false },
  section: { label: 'Section', category: 'layout', canHaveChildren: true },
  container: { label: 'Container', category: 'layout', canHaveChildren: true },
  row: { label: 'Row', category: 'layout', canHaveChildren: true },
  column: { label: 'Column', category: 'layout', canHaveChildren: true },
  grid: { label: 'Grid', category: 'layout', canHaveChildren: true },
  spacer: { label: 'Spacer', category: 'layout', canHaveChildren: false },
  card: { label: 'Card', category: 'interface', canHaveChildren: false },
  hero: { label: 'Hero', category: 'interface', canHaveChildren: false },
  cta: { label: 'Call To Action', category: 'interface', canHaveChildren: false },
  informationBox: { label: 'Information Box', category: 'learning', canHaveChildren: false },
  learningObjectives: { label: 'Learning Objectives', category: 'learning', canHaveChildren: false },
  activity: { label: 'Exercise', category: 'learning', canHaveChildren: false },
  assignment: { label: 'Assignment', category: 'learning', canHaveChildren: false },
  quiz: { label: 'Quiz', category: 'learning', canHaveChildren: false },
  advert: { label: 'Advert', category: 'interface', canHaveChildren: false },
};

// The registry is intentionally data-driven: new components can be added here
// without changing the editor shell or tree commands.
[
  ['paragraph', 'Paragraph', 'text'], ['orderedList', 'Ordered List', 'text'],
  ['unorderedList', 'Unordered List', 'text'], ['table', 'Table', 'text'],
  ['callout', 'Callout', 'text'], ['highlight', 'Highlight', 'text'],
  ['label', 'Label', 'text'], ['badge', 'Badge', 'text'],
  ['statistic', 'Statistic', 'text'], ['definition', 'Definition', 'text'],
  ['audio', 'Audio', 'media'], ['gallery', 'Gallery', 'media'],
  ['carousel', 'Carousel', 'media'], ['imageComparison', 'Image Comparison', 'media'],
  ['mediaEmbed', 'Media Embed', 'media'], ['pdfViewer', 'PDF Viewer', 'media'],
  ['fileDownload', 'File Download', 'media'], ['map', 'Map', 'media'],
  ['stack', 'Stack', 'layout'], ['columns', 'Columns', 'layout'],
  ['splitLayout', 'Split Layout', 'layout'], ['fullWidthLayout', 'Full Width Layout', 'layout'],
  ['sidebarLayout', 'Sidebar Layout', 'layout'], ['masonry', 'Masonry', 'layout'],
  ['stickyContainer', 'Sticky Container', 'layout'], ['contentGroup', 'Content Group', 'layout'],
  ['header', 'Header', 'navigation'], ['navigationMenu', 'Navigation Menu', 'navigation'],
  ['footer', 'Footer', 'navigation'], ['breadcrumb', 'Breadcrumb', 'navigation'],
  ['sidebarNavigation', 'Sidebar Navigation', 'navigation'], ['pagination', 'Pagination', 'navigation'],
  ['tableOfContents', 'Table of Contents', 'navigation'], ['tabsNavigation', 'Tabs Navigation', 'navigation'],
  ['stepNavigation', 'Step Navigation', 'navigation'],
  ['buttonGroup', 'Button Group', 'interface'], ['modal', 'Modal', 'interface'],
  ['accordion', 'Accordion', 'interface'], ['tabs', 'Tabs', 'interface'],
  ['tooltip', 'Tooltip', 'interface'], ['dropdown', 'Dropdown', 'interface'],
  ['alert', 'Alert', 'interface'], ['progressBar', 'Progress Bar', 'interface'],
  ['progressCircle', 'Progress Circle', 'interface'], ['toggle', 'Toggle', 'interface'],
  ['form', 'Form', 'interface'], ['inputGroup', 'Input Group', 'interface'],
  ['loginForm', 'Login Form', 'interface'],
  ['learningObjective', 'Learning Objective', 'learning'], ['lessonIntroduction', 'Lesson Introduction', 'learning'],
  ['example', 'Example', 'learning'], ['demonstration', 'Demonstration', 'learning'],
  ['exercise', 'Exercise', 'learning'], ['multipleChoiceQuestion', 'Multiple Choice Question', 'learning'],
  ['trueFalseQuestion', 'True/False Question', 'learning'], ['fillBlankQuestion', 'Fill in the Blank', 'learning'],
  ['codeExercise', 'Code Exercise', 'learning'], ['hint', 'Hint', 'learning'],
  ['answerReveal', 'Answer Reveal', 'learning'], ['checkpoint', 'Checkpoint', 'learning'],
  ['reflection', 'Reflection', 'learning'], ['summary', 'Summary', 'learning'],
  ['vocabulary', 'Vocabulary', 'learning'], ['learningProgress', 'Learning Progress', 'learning'],
  ['completionNotice', 'Completion Notice', 'learning'],
  ['testimonial', 'Testimonial', 'marketing'], ['pricing', 'Pricing', 'marketing'],
  ['featureSection', 'Feature Section', 'marketing'], ['newsletter', 'Newsletter', 'marketing'],
  ['announcement', 'Announcement', 'marketing'], ['socialLinks', 'Social Links', 'marketing'],
  ['contactSection', 'Contact Section', 'marketing'],
  ['countdown', 'Countdown', 'utility'], ['rating', 'Rating', 'utility'],
  ['share', 'Share', 'utility'], ['comments', 'Comments', 'utility'],
  ['customEmbed', 'Custom Embed', 'utility'],
].forEach(function ([type, label, category]) {
  COMPONENT_REGISTRY[type] = { label, category, canHaveChildren: false, fallback: 'text' };
});

const COMPONENT_TYPES = new Set(Object.keys(COMPONENT_REGISTRY));

function getComponentDefinition(type) {
  return COMPONENT_REGISTRY[type] || null;
}

module.exports = { COMPONENT_REGISTRY, COMPONENT_TYPES, getComponentDefinition };
