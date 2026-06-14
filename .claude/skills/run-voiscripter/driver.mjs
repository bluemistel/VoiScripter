// VoiScripter ヘッドレスブラウザドライバー
// 前提: dev サーバー起動済み + `npm i --no-save playwright-core` 済み
// 使い方: node .claude/skills/run-voiscripter/driver.mjs [smoke|explorer] [--url http://localhost:3000]
//
// playwright のブラウザDLは不要 — システムの Chrome/Edge を使う。
// スクリーンショットは node_modules/.cache/voiscripter-run/ に保存される。

import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) ?? 'smoke';
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:3000';

const SHOTS = resolve('node_modules/.cache/voiscripter-run');
mkdirSync(SHOTS, { recursive: true });

const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = BROWSER_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('FAILED: Chrome/Edge が見つかりません。BROWSER_CANDIDATES を確認してください');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const shot = async (name) => {
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path });
  console.log('SCREENSHOT:', path);
};

// アプリのロード完了（ローディング画面の解除）まで待つ
const waitForApp = async () => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('header', { timeout: 30000 });
  await page.waitForTimeout(2500); // ローディングオーバーレイのフェードを待つ
};

// dnd-kit PointerSensor(activationConstraint distance:8) 対応の手動ドラッグ
// eslint-disable-next-line no-unused-vars
const dragTo = async (sourceLocator, targetLocator) => {
  const src = await sourceLocator.boundingBox();
  const dst = await targetLocator.boundingBox();
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(src.x + src.width / 2 + 12, src.y + src.height / 2, { steps: 3 });
  await page.waitForTimeout(150);
  await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 12 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(600);
};

try {
  await waitForApp();
  await shot('01-app-loaded');

  if (command === 'smoke') {
    // 代表フロー: エクスプローラーを開いて閉じるだけ（状態を変更しない）
    await page.click('button[title="プロジェクトを開く"]');
    await page.waitForSelector('button[title="新しいフォルダを作成"]', { timeout: 5000 });
    await shot('02-explorer-open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else if (command === 'explorer') {
    // フル: フォルダ作成→プロジェクト作成→フォルダへ移動（コンテキストは使い捨てなので残らない）
    await page.click('button[title="プロジェクトを開く"]');
    await page.waitForSelector('button[title="新しいフォルダを作成"]', { timeout: 5000 });
    await page.click('button[title="新しいフォルダを作成"]');
    await page.fill('input[placeholder="フォルダ名を入力"]', 'スモークF');
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(500);
    await page.click('button[title="新しいプロジェクトを作成"]');
    await page.fill('input[placeholder="プロジェクト名を入力"]', 'スモークP');
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(1500);
    await page.click('button[title="プロジェクトを開く"]');
    await page.waitForTimeout(600);
    const row = page.locator('div.group', { hasText: 'スモークP' }).last();
    await row.hover();
    await row.locator('button[title="メニュー"]').click();
    await page.waitForTimeout(300);
    await page.click('text=フォルダへ移動…');
    await page.waitForTimeout(400);
    await page.locator('button:has-text("スモークF")').last().click();
    await page.waitForTimeout(800);
    await shot('02-explorer-full');
    const ok = await page.isVisible('text=スモークP');
    console.log('PROJECT_IN_FOLDER:', ok);
    if (!ok) process.exitCode = 1;
  } else {
    console.error('unknown command:', command, '(smoke | explorer)');
    process.exitCode = 1;
  }

  console.log('CONSOLE_ERRORS:', errors.length === 0 ? 'none' : errors.join('\n'));
  if (errors.length > 0) process.exitCode = 1;
  console.log(process.exitCode ? 'FAILED' : 'OK');
} catch (e) {
  await shot('99-failure');
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
