import {chromium} from 'file:///C:/Users/mattp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const out = fileURLToPath(new URL('.',import.meta.url));
const base = 'http://127.0.0.1:5197/';
const key = 'vpsf.evaluationArchive.v1';
const california = '53017 Double View Lane, Idyllwild, CA 92549';
const results = [];
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  for (const [name,viewport] of [['phone',{width:390,height:844}],['laptop',{width:1366,height:900}]]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const report = {name,viewport,checks:[],errors:[],failedResponses:[],blockedExternal:[],scoreRequests:[]};
    let stage = 'start';
    page.on('pageerror',error=>{report.errors.push(error.stack || error.message); console.error(name,'PAGE ERROR',error.stack || error.message);});
    page.on('response',response=>{if(response.status()>=400) report.failedResponses.push({status:response.status(),url:response.url()});});
    page.on('request',request=>{
      if(request.method()==='POST' && new URL(request.url()).pathname.endsWith('/score')) {
        report.scoreRequests.push({url:request.url(),input:request.postDataJSON()});
      }
    });
    // Keep browser traffic on the two explicitly authorized local services.
    await context.route('**/*',route=>{
      const url = new URL(route.request().url());
      if (['127.0.0.1','localhost'].includes(url.hostname) && ['5197','8197'].includes(url.port)) return route.continue();
      if (['data:','blob:'].includes(url.protocol)) return route.continue();
      report.blockedExternal.push(url.href);
      return route.abort();
    });
    const check = label => {report.checks.push(label);console.log(name,label,'PASS');};
    const shot = async suffix => {
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal viewport overflow');
      await page.screenshot({path:`${out}${name}-${suffix}.png`,fullPage:false});
    };
    const stored = () => page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const openArchive = async () => {
      await page.getByRole('button',{name:'My Scores',exact:true}).click();
      await page.getByRole('button',{name:'ARCHIVE',exact:true}).click();
      await page.getByRole('heading',{name:'Archive',exact:true}).waitFor();
    };
    const dashboard = async () => ({
      total:await page.locator('.scoreGauge strong').innerText(),
      ranking:await page.locator('.rankingTitle').innerText(),
      pillars:await page.locator('.pillarGrid').innerText()
    });
    try {
      await page.goto(base);
      assert.equal(await page.getByRole('textbox',{name:'Property address',exact:true}).inputValue(),california);
      await shot('start');
      stage = 'generate Basic demo';
      await page.getByRole('button',{name:/1\. Basic/}).first().click();
      await page.getByRole('heading',{name:'Review Available Information',exact:true}).waitFor();
      const responsePromise = page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname.endsWith('/score'));
      await page.getByRole('button',{name:'Generate Basic Analysis',exact:true}).click();
      const response = await responsePromise;
      assert.equal(response.status(),200,await response.text());
      assert.equal(new URL(response.url()).port,'8197');
      const score = await response.json();
      await page.getByRole('heading',{name:'VPSF Score Overview',exact:true}).waitFor();
      const original = await dashboard();
      assert.equal(Number(original.total),score.total);
      assert.equal(report.scoreRequests.length,1);
      const archive = await stored();
      assert.equal(archive.evaluations.length,1);
      const saved = archive.evaluations[0];
      assert.deepEqual(saved.result,score);
      assert.deepEqual(saved.home,report.scoreRequests[0].input);
      assert.ok(saved.home.demoScenario,'Demo marker must survive archive save');
      check('Basic demo score saved with exact raw/result snapshots');
      await shot('generated');
      stage = 'My Scores archive';
      await openArchive();
      assert.equal(await page.locator('.evaluationArchive article').count(),1);
      assert.match(await page.locator('.evaluationArchive article').innerText(),new RegExp(String(score.total)));
      await shot('archive');
      check('My Scores ARCHIVE displays completed evaluation');
      stage = 'restart default';
      await page.getByRole('button',{name:'Back to My Scores',exact:true}).click();
      await page.getByRole('button',{name:'Restart',exact:true}).click();
      assert.equal(await page.getByRole('textbox',{name:'Property address',exact:true}).inputValue(),california);
      check('Restart defaults to California demo address');
      stage = 'reload persistence';
      await page.reload();
      await page.getByRole('textbox',{name:'Property address',exact:true}).waitFor();
      await openArchive();
      assert.deepEqual((await stored()).evaluations,[saved]);
      assert.equal(await page.locator('.evaluationArchive article').count(),1);
      check('Archive survives reload unchanged');
      stage = 'view saved score';
      const countBeforeView = report.scoreRequests.length;
      await page.getByRole('button',{name:'View saved score',exact:true}).click();
      await page.getByRole('heading',{name:'VPSF Score Overview',exact:true}).waitFor();
      assert.deepEqual(await dashboard(),original);
      // Also observe beyond the application's scoring animation duration.
      await page.waitForTimeout(3500);
      assert.equal(report.scoreRequests.length,countBeforeView);
      assert.deepEqual((await stored()).evaluations,[saved]);
      await shot('restored-score');
      check('View restores exact total/ranking/pillars with zero scoring requests');
      stage = 'edit restored inputs';
      await openArchive();
      await page.getByRole('button',{name:'Edit home details',exact:true}).click();
      await page.getByRole('heading',{name:'Add Property Details',exact:true}).waitFor();
      for (const [label,field] of [['Property Address','address'],['Home Type','homeType'],['Year Built','yearBuilt'],['Square Footage','squareFeet'],['Stories','stories'],['Zip Code','zip'],['Lot Size','lotSize'],['Occupancy Type','occupancy'],['Bedrooms','bedrooms'],['Bathrooms','bathrooms'],['Garage / Parking','garage']]) {
        assert.equal(await page.locator('label.field').filter({has:page.getByText(label,{exact:true})}).locator('input,select').inputValue(),String(saved.home[field] ?? ''),field);
      }
      assert.equal(report.scoreRequests.length,countBeforeView);
      await shot('restored-edit');
      check('Edit restores saved property inputs without scoring');
      stage = 'remove';
      await openArchive();
      await page.getByRole('button',{name:'Remove from archive',exact:true}).click();
      await page.getByRole('button',{name:'Yes, remove',exact:true}).click();
      await page.getByRole('heading',{name:'No saved evaluations yet',exact:true}).waitFor();
      assert.deepEqual((await stored()).evaluations,[]);
      await shot('removed');
      await page.reload();
      await openArchive();
      await page.getByRole('heading',{name:'No saved evaluations yet',exact:true}).waitFor();
      assert.equal(report.scoreRequests.length,1);
      check('Removal and empty archive persist after reload');
      assert.deepEqual(report.errors,[],'Browser runtime errors');
      report.passed = true;
    } catch (error) {
      report.passed = false; report.failure = {stage,message:error.message,stack:error.stack};
      await page.screenshot({path:`${out}${name}-failure.png`}).catch(()=>{});
      await writeFile(`${out}${name}-failure.txt`,await page.locator('body').innerText().catch(()=>''));
      console.error(name,stage,error.message);
      // A separate reload lets removal be checked even if an edit screen crashed.
      try {
        await page.reload();
        await openArchive();
        await page.getByRole('button',{name:'Remove from archive',exact:true}).click();
        await page.getByRole('button',{name:'Yes, remove',exact:true}).click();
        await page.getByRole('heading',{name:'No saved evaluations yet',exact:true}).waitFor();
        assert.deepEqual((await stored()).evaluations,[]);
        await shot('removed');
        await page.reload(); await openArchive();
        await page.getByRole('heading',{name:'No saved evaluations yet',exact:true}).waitFor();
        check('Removal separately verified and persists after reload');
      } catch (removalError) {report.removalFailure=removalError.message;}
    } finally {
      results.push(report);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${out}results.json`,JSON.stringify(results,null,2));
}
if (results.some(result=>!result.passed)) process.exitCode=1;
