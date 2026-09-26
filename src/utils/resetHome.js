const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { ObjectId } = require('mongodb');
const { connect, getDb, close } = require('../db/connect');

function block(pageId, type, order, data, parentId = null) {
  const id = new ObjectId();
  return {
    _id: id,
    pageId,
    parentId,
    type,
    order,
    visible: true,
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function resetHome() {
  try {
    await connect();
    const db = getDb();
    const now = new Date();

    const pages = await db.collection('pages').find({}).project({ _id: 1 }).toArray();
    const pageIds = pages.map((page) => page._id);
    if (pageIds.length) await db.collection('content').deleteMany({ pageId: { $in: pageIds } });
    await db.collection('pages').deleteMany({});

    const pageId = new ObjectId();
    await db.collection('pages').insertOne({
      _id: pageId,
      title: 'WebDev Studio',
      slug: 'home',
      description: 'A focused place to learn, practice, and build for the web.',
      category: 'Home',
      weekNumber: null,
      status: 'published',
      seoTitle: 'WebDev Studio - Learn by Building',
      seoDescription: 'Learn modern web development through practical lessons and projects.',
      settings: { showHeader: true, showFooter: true, showSidebar: false },
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });

    const blocks = [];
    const hero = block(pageId, 'section', 1, {
      semanticTag: 'section', display: 'block', background: '#10213f', padding: '5rem 3rem',
      textColor: '#ffffff', borderRadius: '0.75rem', useBackground: true,
    });
    const heroInner = block(pageId, 'container', 1, {
      semanticTag: 'div', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%',
      maxWidth: '64rem', margin: '0 auto', alignItems: 'start',
    }, hero._id);
    const heroKicker = block(pageId, 'text', 1, { content: '<p><strong>WEBDEV STUDIO</strong> / A PRACTICAL LEARNING PLATFORM</p>', textColor: '#9ec5ff' }, heroInner._id);
    const heroTitle = block(pageId, 'heading', 2, { text: 'Build websites that feel like yours.', level: 'h2', textColor: '#ffffff' }, heroInner._id);
    const heroText = block(pageId, 'text', 3, { content: '<p>Learn the web by making real things. Work through clear lessons, experiment in public, and turn every concept into a small project.</p>', textColor: '#dce9ff' }, heroInner._id);
    const heroButton = block(pageId, 'button', 4, { text: 'Start building', url: '#', style: 'primary', openInNewTab: false }, heroInner._id);

    const intro = block(pageId, 'section', 2, { semanticTag: 'section', display: 'block', padding: '4rem 1rem' });
    const introGrid = block(pageId, 'container', 1, { semanticTag: 'div', display: 'grid', columns: 2, gap: '3rem', width: '100%', maxWidth: '72rem', margin: '0 auto' }, intro._id);
    const introCopy = block(pageId, 'container', 1, { semanticTag: 'article', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }, introGrid._id);
    const introHeading = block(pageId, 'heading', 1, { text: 'A calmer way to learn the web.', level: 'h3' }, introCopy._id);
    const introText = block(pageId, 'text', 2, { content: '<p>No mystery stacks or noisy tutorials. Start with HTML, add CSS, bring in JavaScript, and keep building until the ideas stick.</p><p>Each lesson gives you a clear next step and enough room to make the work your own.</p>' }, introCopy._id);
    const introLink = block(pageId, 'link', 3, { text: 'Keep exploring ->', url: '#', openInNewTab: false }, introCopy._id);
    const introImage = block(pageId, 'image', 2, { imageUrl: '/uploads/1789904365713-154804525.jpeg', altText: 'A bright street viewed as a place to explore', caption: 'Learn the fundamentals. Then make something unmistakably yours.' }, introGrid._id);

    const features = block(pageId, 'section', 3, { semanticTag: 'section', display: 'block', background: '#f0f5ff', padding: '4rem 1rem', useBackground: true });
    const featuresInner = block(pageId, 'container', 1, { semanticTag: 'div', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '72rem', margin: '0 auto' }, features._id);
    const featuresHeading = block(pageId, 'heading', 1, { text: 'Learn in layers.', level: 'h3' }, featuresInner._id);
    const featureGrid = block(pageId, 'container', 2, { semanticTag: 'div', display: 'grid', columns: 3, gap: '1rem', width: '100%' }, featuresInner._id);
    [
      ['01', 'Understand', 'Build a strong mental model before you reach for a shortcut.'],
      ['02', 'Practice', 'Turn each idea into a small, visible experiment.'],
      ['03', 'Ship', 'Finish with pages and projects you can actually show.'],
    ].forEach(function (item, index) {
      const card = block(pageId, 'container', index + 1, { semanticTag: 'article', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', padding: '1.5rem', background: '#ffffff', borderRadius: '0.65rem', useBackground: true }, featureGrid._id);
      blocks.push(card);
      const cardLabel = block(pageId, 'text', 1, { content: '<p><strong>' + item[0] + '</strong></p>' }, card._id);
      const cardTitle = block(pageId, 'heading', 2, { text: item[1], level: 'h4' }, card._id);
      const cardText = block(pageId, 'text', 3, { content: '<p>' + item[2] + '</p>' }, card._id);
      blocks.push(cardLabel, cardTitle, cardText);
    });

    const closing = block(pageId, 'section', 4, { semanticTag: 'section', display: 'block', padding: '4rem 1rem' });
    const closingInner = block(pageId, 'container', 1, { semanticTag: 'div', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '52rem', margin: '0 auto', alignItems: 'center' }, closing._id);
    const closingHeading = block(pageId, 'heading', 1, { text: 'Your next project starts here.', level: 'h3', align: 'center' }, closingInner._id);
    const closingText = block(pageId, 'text', 2, { content: '<p>Open the builder, choose a container, and make the page yours one element at a time.</p>', align: 'center' }, closingInner._id);
    const closingButton = block(pageId, 'button', 3, { text: 'Start building', url: '#', style: 'primary', openInNewTab: false }, closingInner._id);

    blocks.push(hero, heroInner, heroKicker, heroTitle, heroText, heroButton, intro, introGrid, introCopy, introHeading, introText, introLink, introImage, features, featuresInner, featuresHeading, featureGrid, closing, closingInner, closingHeading, closingText, closingButton);
    await db.collection('content').insertMany(blocks);
    await db.collection('settings').updateOne(
      { key: 'header' },
      { $set: { key: 'header', data: { logoText: 'WebDev Studio', logoImage: '', navItems: [{ label: 'Home', url: '/', type: 'link' }] }, updatedAt: now } },
      { upsert: true }
    );
    await db.collection('settings').updateOne(
      { key: 'footer' },
      { $set: { key: 'footer', data: { aboutText: 'Learn by building.', logoImage: '', columns: [], social: [], copyright: 'WebDev Studio' }, updatedAt: now } },
      { upsert: true }
    );
    console.log('Home reset complete: one published home page with nested containers.');
  } finally {
    await close();
  }
}

resetHome().catch((error) => {
  console.error('Home reset failed:', error.message);
  process.exitCode = 1;
});
