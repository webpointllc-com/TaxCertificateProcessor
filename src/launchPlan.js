'use strict';

const REPO = 'https://github.com/webpointllc-com/TaxCertificateProcessor';

const launchPlan = {
  monthly: 14,
  annual: 168,
  region: 'oregon',
  postgresMajorVersion: 16,
  billingUrl: 'https://dashboard.render.com/billing',
  blueprintUrl: `https://dashboard.render.com/blueprint/new?repo=${REPO}`,
  groqKeysUrl: 'https://console.groq.com/keys',
  liveOrigin: 'https://tax-certificate-processor.onrender.com',
  searchingPage: 'https://webpointllc.com/searching',
  searchingIframeClass: 'wp-tcs-frame',
  repo: REPO,
  selected: [
    {
      id: 'web',
      selected: true,
      required: true,
      billed: true,
      name: 'Render web Starter',
      monthly: 7,
      plan: 'starter',
      region: 'oregon',
      bind: '0.0.0.0:$PORT',
      note: 'Always-on Squarespace iframe. Free web spins down after 15 minutes — do not use it.'
    },
    {
      id: 'db',
      selected: true,
      required: true,
      billed: true,
      name: 'Render PostgreSQL Basic 256MB',
      monthly: 7,
      plan: 'basic-256mb',
      region: 'oregon',
      version: 16,
      blueprintName: 'webpoint-tcs-db',
      note: 'Durable accounts, conversation log, tsvector RAG. Render disk is ephemeral. Do not use Free Postgres (expires in 30 days).'
    },
    {
      id: 'groq',
      selected: true,
      required: false,
      billed: false,
      name: 'Groq Llama 3.3 70B',
      monthly: 0,
      note: 'Workhorse LLM. Free key first from console.groq.com/keys. Paste into Render Dashboard after Blueprint apply. Never commit the key.'
    }
  ],
  scaleLater: [
    {
      id: 'standard',
      selected: false,
      name: 'Web Standard',
      monthly: 25,
      note: 'Next rung when Starter CPU is saturated. Same Node process.'
    },
    {
      id: 'pro',
      selected: false,
      name: 'Web Pro + autoscale',
      monthly: 85,
      note: 'Ready-to-scale rung. Same Dockerfile / DATABASE_URL. Not this month.'
    }
  ],
  notThisMonth: [
    'Pinecone',
    'Algolia',
    'Elastic Cloud',
    'OpenAI embeddings',
    'SerpAPI',
    'browserless',
    'greenfield AWS ALB + Fargate + RDS + NAT ($45–90/mo)'
  ]
};

module.exports = { launchPlan, REPO };
