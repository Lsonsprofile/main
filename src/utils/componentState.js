const CONTENT_KEYS = new Set([
  'text', 'content', 'title', 'subtitle', 'caption', 'altText', 'description',
  'buttonText', 'buttonUrl', 'url', 'imageUrl', 'link', 'provider', 'language',
  'code', 'question', 'options', 'optionsText', 'items', 'itemsText', 'objectives',
  'objectivesText', 'correctIndex', 'explanation', 'author', 'instructions',
  'requirements', 'submissionInstructions', 'difficulty', 'placeholder',
]);

const LAYOUT_KEYS = new Set([
  'display', 'semanticTag', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight',
  'maxHeight', 'padding', 'margin', 'gap', 'columns', 'rows', 'flexDirection',
  'flexWrap', 'justifyContent', 'alignItems', 'order', 'align', 'useContainer',
]);

const STYLE_KEYS = new Set([
  'textColor', 'background', 'backgroundColor', 'useBackground', 'border',
  'borderRadius', 'boxShadow', 'hoverEffect', 'opacity', 'fontFamily', 'fontSize',
  'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'style',
]);

const ANIMATION_KEYS = new Set([
  'animation', 'animationTrigger', 'animationDuration', 'animationDelay',
  'animationDirection', 'animationRepeat', 'animationEasing',
]);

function pick(source, keys) {
  return Object.fromEntries(Object.entries(source || {}).filter(([key]) => keys.has(key)));
}

function normalizeComponentState(raw = {}, previous = {}) {
  const flat = { ...(previous.data || {}), ...(raw || {}) };
  const responsive = {
    ...(previous.responsive || {}),
    desktop: { ...(previous.responsive && previous.responsive.desktop), ...(raw.responsiveDesktop || {}) },
    tablet: { ...(previous.responsive && previous.responsive.tablet), ...(raw.responsiveTablet || {}) },
    mobile: { ...(previous.responsive && previous.responsive.mobile), ...(raw.responsiveMobile || {}) },
  };
  delete flat.responsiveDesktop;
  delete flat.responsiveTablet;
  delete flat.responsiveMobile;

  return {
    data: flat,
    content: { ...(previous.content || {}), ...pick(flat, CONTENT_KEYS) },
    layout: { ...(previous.layout || {}), ...pick(flat, LAYOUT_KEYS) },
    style: { ...(previous.style || {}), ...pick(flat, STYLE_KEYS) },
    responsive,
    animation: { ...(previous.animation || {}), ...pick(flat, ANIMATION_KEYS) },
  };
}

module.exports = { normalizeComponentState };
