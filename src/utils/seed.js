/**
 * Seed script – populates sample published lessons from the 36-week curriculum.
 * Run: npm run seed
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connect, getDb, close } = require('../db/connect');

const CURRICULUM = [
  { week: 1, slug: 'intro-to-web-dev', title: 'Workspace Setup and Introduction to Web Development', category: 'HTML',
    description: 'Get your development environment ready and understand what web development is all about.' },
  { week: 2, slug: 'vs-code-setup', title: 'VS Code, Files, Folders and Developer Tools', category: 'HTML',
    description: 'Master Visual Studio Code, organize projects, and use the browser developer tools.' },
  { week: 3, slug: 'html-document-structure', title: 'HTML Document Structure', category: 'HTML',
    description: 'Understand the basic structure of every HTML page: doctype, html, head and body.' },
  { week: 4, slug: 'head-section-metadata', title: 'Head Section, Title and Metadata', category: 'HTML',
    description: 'Learn the head element, page titles, and essential meta tags.' },
  { week: 5, slug: 'open-graph-metadata', title: 'Open Graph and Social Sharing Metadata', category: 'HTML',
    description: 'Add Open Graph tags so links look great when shared on social media.' },
  { week: 6, slug: 'headings-paragraphs-text', title: 'Headings, Paragraphs and Text Content', category: 'HTML',
    description: 'Structure readable content with headings, paragraphs, and text emphasis.' },
  { week: 7, slug: 'html-links-navigation', title: 'HTML Links and Navigation', category: 'HTML',
    description: 'Create internal and external links and build simple navigation.' },
  { week: 8, slug: 'images-accessibility-media', title: 'Images, Accessibility and Media', category: 'HTML',
    description: 'Add images with meaningful alt text and introduce basic media elements.' },
  { week: 9, slug: 'html-lists-tables', title: 'HTML Lists and Tables', category: 'HTML',
    description: 'Organize information with ordered lists, unordered lists, and tables.' },
  { week: 10, slug: 'semantic-html', title: 'Semantic HTML and Page Structure', category: 'HTML',
    description: 'Use semantic elements like header, main, nav, article, and footer.' },
  { week: 11, slug: 'html-forms', title: 'HTML Forms', category: 'HTML',
    description: 'Build forms with inputs, labels, and buttons for user data.' },
  { week: 12, slug: 'html-review-mini-project', title: 'HTML Review and Mini Project', category: 'HTML',
    description: 'Review HTML fundamentals and complete a small multi-page project.' },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || '(not set)';
    console.log('Using MongoDB URI:', uri.replace(/:([^@]+)@/, ':********@'));
    console.log('Database name:', process.env.MONGODB_DB_NAME || '(not set)');

    await connect();
    const db = getDb();

    const slugs = CURRICULUM.map((c) => c.slug);
    console.log('Clearing previous seed pages…');
    const oldPages = await db.collection('pages').find({ slug: { $in: slugs } }).toArray();
    const oldIds = oldPages.map((p) => p._id);
    if (oldIds.length) {
      await db.collection('content').deleteMany({ pageId: { $in: oldIds } });
      await db.collection('pages').deleteMany({ _id: { $in: oldIds } });
    }

    console.log('Inserting curriculum pages…');
    const now = new Date();
    const pageDocs = CURRICULUM.map((c) => ({
      title: c.title,
      slug: c.slug,
      description: c.description,
      category: c.category,
      weekNumber: c.week,
      status: 'published',
      seoTitle: `Week ${c.week} – ${c.title}`,
      seoDescription: c.description,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    }));

    const result = await db.collection('pages').insertMany(pageDocs);
    const pageIds = Object.values(result.insertedIds);

    console.log('Inserting content blocks…');
    const blocks = [];

    pageIds.forEach((pageId, i) => {
      const c = CURRICULUM[i];
      blocks.push(
        {
          pageId,
          parentId: null,
          type: 'learningObjectives',
          order: 1,
          visible: true,
          data: {
            objectives: [
              `Understand the main goals of week ${c.week}`,
              `Complete the practice activities for ${c.title}`,
              'Apply what you learn in a small exercise',
            ],
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          pageId,
          parentId: null,
          type: 'heading',
          order: 2,
          visible: true,
          data: { text: c.title, level: 'h2' },
          createdAt: now,
          updatedAt: now,
        },
        {
          pageId,
          parentId: null,
          type: 'text',
          order: 3,
          visible: true,
          data: {
            content: `<p>${c.description}</p><p>This lesson is part of the progressive 36-week web development curriculum. Work through the content carefully and try the activities.</p>`,
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          pageId,
          parentId: null,
          type: 'informationBox',
          order: 4,
          visible: true,
          data: {
            title: 'Tip',
            style: 'tip',
            content: '<p>Take notes as you go. Writing things down helps you remember and makes review easier later.</p>',
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          pageId,
          parentId: null,
          type: 'activity',
          order: 5,
          visible: true,
          data: {
            title: `Week ${c.week} Practice`,
            difficulty: 'Easy',
            instructions: `<p>Review the concepts for <strong>${c.title}</strong> and build a small example on your computer.</p>`,
          },
          createdAt: now,
          updatedAt: now,
        }
      );
    });

    await db.collection('content').insertMany(blocks);

    // --- Site pages: home, about, contact (editable in admin) ---
    console.log('Seeding site pages (home, about, contact)…');
    const siteSlugs = ['home', 'about', 'contact'];
    const oldSite = await db.collection('pages').find({ slug: { $in: siteSlugs } }).toArray();
    const oldSiteIds = oldSite.map((p) => p._id);
    if (oldSiteIds.length) {
      await db.collection('content').deleteMany({ pageId: { $in: oldSiteIds } });
      await db.collection('pages').deleteMany({ _id: { $in: oldSiteIds } });
    }

    const sitePages = [
      {
        title: 'Build the Web with Confidence',
        slug: 'home',
        description: 'A progressive 36-week curriculum covering HTML, CSS, JavaScript and full-stack fundamentals.',
        category: 'Site',
        weekNumber: null,
        status: 'published',
        seoTitle: 'Web Development Learning Platform',
        seoDescription: 'Free progressive web development course. Learn HTML, CSS and JavaScript week by week.',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      },
      {
        title: 'About This Platform',
        slug: 'about',
        description: 'Why this learning platform exists and how it is built.',
        category: 'Site',
        weekNumber: null,
        status: 'published',
        seoTitle: 'About – Web Development Learning Platform',
        seoDescription: 'Learn about our progressive web development curriculum and teaching approach.',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      },
      {
        title: 'Contact',
        slug: 'contact',
        description: 'Questions or feedback? Get in touch.',
        category: 'Site',
        weekNumber: null,
        status: 'published',
        seoTitle: 'Contact – Web Development Learning Platform',
        seoDescription: 'Contact the Web Development Learning Platform team.',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      },
    ];

    const siteResult = await db.collection('pages').insertMany(sitePages);
    const siteIds = Object.values(siteResult.insertedIds);

    const siteBlocks = [
      // Home
      { pageId: siteIds[0], parentId: null, type: 'hero', order: 1, visible: true,
        data: { title: 'Master Web Development, One Week at a Time', subtitle: 'Structured lessons, real projects, no framework lock-in.', buttonText: 'Browse Lessons', buttonUrl: '/lessons', style: 'centered' },
        createdAt: now, updatedAt: now },
      { pageId: siteIds[0], parentId: null, type: 'text', order: 2, visible: true,
        data: { content: '<p>This platform teaches HTML, CSS and JavaScript through a clear 36-week path. All lesson content is managed by administrators — no hard-coded pages.</p>' },
        createdAt: now, updatedAt: now },
      { pageId: siteIds[0], parentId: null, type: 'cta', order: 3, visible: true,
        data: { title: 'Ready to start?', text: 'Create a free account and begin with Week 1.', buttonText: 'Register', buttonUrl: '/register' },
        createdAt: now, updatedAt: now },
      // About
      { pageId: siteIds[1], parentId: null, type: 'text', order: 1, visible: true,
        data: { content: '<p>This Interactive Web Development Learning Platform is a full-stack, server-rendered application built with Node.js, Express, EJS and MongoDB.</p><p>Administrators create and edit pages and content blocks through the admin panel. Learners read published material and leave comments after registering.</p>' },
        createdAt: now, updatedAt: now },
      { pageId: siteIds[1], parentId: null, type: 'informationBox', order: 2, visible: true,
        data: { title: 'Built for learning', style: 'info', content: '<p>The same technologies taught in the curriculum power this site: semantic HTML, modern CSS, vanilla JavaScript, and a clean Express architecture.</p>' },
        createdAt: now, updatedAt: now },
      // Contact
      { pageId: siteIds[2], parentId: null, type: 'text', order: 1, visible: true,
        data: { content: '<p>Use the form below to send a message. You can also edit this page in the admin panel to add maps, extra contact details, or FAQs.</p>' },
        createdAt: now, updatedAt: now },
    ];

    await db.collection('content').insertMany(siteBlocks);

    console.log('Seed completed successfully!');
    console.log(`  • ${pageDocs.length} published lessons (weeks 1–${CURRICULUM.length})`);
    console.log(`  • ${blocks.length} lesson content blocks`);
    console.log('  • Site pages: home, about, contact (editable in admin)');
    console.log('\nVisit http://localhost:3000/lessons');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await close();
  }
}

seed();
