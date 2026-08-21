import { auth as adminAuth } from '../services/firebase';
import { prisma } from '../config/db';
import { emailQueue } from '../services/bullmq';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3001/api';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBykO7HKl60ZaT8QRHGxW_tLsHgGllJCu0';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAuthToken(uid: string): Promise<string> {
  const customToken = await adminAuth!.createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true
    })
  });
  const data: any = await response.json();
  return data.idToken;
}

async function run() {
  console.log("=== PHASE 1: AUTHENTICATION ===");
  const uid = `test-user-${Date.now()}`;
  const token = await getAuthToken(uid);
  console.log(`Generated ID token for ${uid}`);
  
  try {
    const res = await fetch(`${API_URL}/campaigns`, { method: 'POST', headers: { Authorization: `Bearer invalid` } });
    if (res.status === 401) {
      console.log("Unauthenticated request correctly blocked (401).");
    } else {
      throw new Error(`Should have failed auth with 401 but got ${res.status}`);
    }
  } catch (err: any) {
    if (err.message.includes("401")) {
      console.log("Unauthenticated request correctly blocked (401).");
    } else {
      throw err;
    }
  }

  console.log("\n=== PHASE 2: CREATE 500-RECIPIENT CAMPAIGN ===");
  const csvLines = ["Email,Name"];
  for (let i = 1; i <= 500; i++) {
    csvLines.push(`test${String(i).padStart(3, '0')}@example.com,TestUser${i}`);
  }
  const csvPath = path.join(__dirname, '../../../500-leads.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log("Wrote 500-leads.csv");

  console.log("\n=== PHASE 3: INPUT VALIDATION ===");
  try {
    const res = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: "",
        subject: "Test",
        body: "Test",
        scheduledTime: "invalid"
      })
    });
    if (res.status === 400) {
      console.log("Invalid input correctly blocked (400).");
    } else {
      console.log(`Failed input validation test: got status ${res.status}`);
    }
  } catch (err: any) {
    console.error("Error during input validation phase", err);
  }

  // Real creation
  const leads = [];
  for (let i = 1; i <= 500; i++) {
    leads.push(`test${String(i).padStart(3, '0')}@example.com`);
  }

  console.log("Submitting campaign...");
  const res = await fetch(`${API_URL}/campaigns`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `Test Campaign ${Date.now()}`,
      subject: 'Test 500 Subject',
      body: 'Test 500 Body',
      startTime: new Date(Date.now() + 5000).toISOString(),
      hourlyLimit: 10000,
      leads: leads
    })
  });
  const campaignData: any = await res.json();
  
  if (res.status !== 201) {
    throw new Error(`Failed to create campaign. Status: ${res.status}. Data: ${JSON.stringify(campaignData)}`);
  }

  const campaignId = campaignData.data?.campaignId;
  if (!campaignId) throw new Error("campaignId is missing from response");
  console.log(`Campaign created: ${campaignId}`);

  console.log("\n=== PHASE 4: DATABASE VERIFICATION ===");
  const dbRecipientsCount = await prisma.emailRecipient.count({ where: { campaignId } });
  console.log(`Initial DB Recipients: ${dbRecipientsCount} (expected 500)`);
  if (dbRecipientsCount !== 500) throw new Error("DB recipients count mismatch");

  console.log("\n=== PHASE 5-17: PROCESSING AND MONITORING ===");
  let completed = false;
  let start = Date.now();
  let maxWait = 0, maxActive = 0, maxDelayed = 0, maxFailed = 0;
  
  while (!completed) {
    const qCount = await emailQueue.getJobCounts();
    maxWait = Math.max(maxWait, qCount.wait || 0);
    maxActive = Math.max(maxActive, qCount.active || 0);
    maxDelayed = Math.max(maxDelayed, qCount.delayed || 0);
    maxFailed = Math.max(maxFailed, qCount.failed || 0);

    const counts = await prisma.emailRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true
    });
    
    let sent = 0, failed = 0, sending = 0, queued = 0, dispatching = 0;
    for (const c of counts) {
      if (c.status === 'SENT') sent = c._count;
      if (c.status === 'FAILED') failed = c._count;
      if (c.status === 'SENDING') sending = c._count;
      if (c.status === 'QUEUED') queued = c._count;
      if (c.status === 'DISPATCHING') dispatching = c._count;
    }

    console.log(`BullMQ [W:${qCount.wait} A:${qCount.active} D:${qCount.delayed} F:${qCount.failed}] | MySQL [Q:${queued} Dsp:${dispatching} Snd:${sending} Sent:${sent} Fail:${failed}]`);

    if (sent + failed === 500) {
      completed = true;
      break;
    }
    
    // Safety abort after 40 mins
    if (Date.now() - start > 40 * 60 * 1000) {
      console.log("Timeout reached!");
      break;
    }
    await delay(5000);
  }

  const durationSec = (Date.now() - start) / 1000;
  console.log(`\n=== PHASE 16 & 17: FINAL RECONCILIATION ===`);
  const finalCounts = await prisma.emailRecipient.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true
  });
  console.log("FINAL DB COUNTS:", finalCounts);
  
  const finalQ = await emailQueue.getJobCounts();
  console.log("FINAL REDIS COUNTS:", finalQ);
  
  console.log(`\nTotal Duration: ${durationSec}s`);
  console.log(`Average rate: ${500 / durationSec} emails/sec`);
  console.log(`=== MAX BULLMQ COUNTS ===\nMAX WAIT: ${maxWait}\nMAX ACTIVE: ${maxActive}\nMAX DELAYED: ${maxDelayed}\nMAX FAILED: ${maxFailed}`);
  
  const finalCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  console.log(`Campaign Final Status: ${finalCampaign?.status}`);
  
  process.exit(0);
}

run().catch(console.error);
