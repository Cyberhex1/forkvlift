import { expect, test, type Page } from "playwright/test";

// Column and card settings live behind a ⋯ button; the panel opens in a portal outside the column.
const menu=async(page:Page,name:string)=>{await page.getByRole('button',{name,exact:true}).click();return page.getByRole('dialog',{name,exact:true});};

test("Studio sign-in, board, column rename, recolor, collapse and WIP warnings", async ({page},info)=>{
  await page.goto('/studio'); await expect(page.getByText('Sign in to your Studio',{exact:true})).toBeVisible();
  await page.screenshot({path:`docs/handoffs/screenshots/2.6-${info.project.name}-signed-out.png`});
  await page.goto('/api/dev/login?as=fx-ada'); await page.goto('/studio');
  const idea=page.getByRole('region',{name:'Column Idea',exact:true});
  await expect(idea).toContainText('Fixture idea: recipe scaler');
  await page.screenshot({path:`docs/handoffs/screenshots/2.6-${info.project.name}-board.png`});
  await idea.getByRole('button',{name:'Rename Idea',exact:true}).click();
  await idea.getByRole('textbox',{name:'Rename Idea',exact:true}).fill('Ideas for the weekend');
  await idea.getByRole('button',{name:'Rename',exact:true}).click();
  const renamed=page.getByRole('region',{name:'Column Ideas for the weekend',exact:true});
  await expect(renamed).toBeVisible();
  const options=await menu(page,'Column options for Ideas for the weekend');
  await options.getByRole('group',{name:'Color for Ideas for the weekend',exact:true}).getByRole('button',{name:'Pixel 7',exact:true}).click();
  await expect(renamed.locator('.bg-pixel-7')).toBeVisible();
  await options.getByLabel('WIP limit for Ideas for the weekend',{exact:true}).fill('1');
  await options.getByLabel('WIP limit for Ideas for the weekend',{exact:true}).press('Tab');
  await expect(renamed.getByText('WIP limit reached · 1/1',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape'); await expect(options).toHaveCount(0);
  await page.screenshot({path:`docs/handoffs/screenshots/2.6-${info.project.name}-wip.png`});
  await renamed.getByRole('button',{name:'Collapse Ideas for the weekend',exact:true}).click();
  await expect(renamed.getByRole('button',{name:'Add card',exact:true})).toHaveCount(0);
  await renamed.getByRole('button',{name:'Expand Ideas for the weekend',exact:true}).click();
  await expect(renamed.getByRole('button',{name:'Add card',exact:true})).toBeVisible();
  const sizes=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth})); expect(sizes.width).toBeLessThanOrEqual(sizes.viewport);
});

test('add/edit/private ideas, visibility toggles, column/card deletion and reorder',async({page})=>{
  await page.goto('/api/dev/login?as=fx-ada'); await page.goto('/studio');
  await page.getByLabel('New column',{exact:true}).fill('Weekend'); await page.getByRole('button',{name:'Add column',exact:true}).click();
  const col=page.getByRole('region',{name:'Column Weekend',exact:true}); await expect(col).toBeVisible();
  await col.getByRole('button',{name:'Add card',exact:true}).click();
  const add=page.getByRole('dialog',{name:'Add Studio card',exact:true}); await add.getByLabel('Card title',{exact:true}).fill('A real local QA idea'); await add.getByLabel('Idea',{exact:true}).fill('Planning text entered during a test.'); await add.getByRole('button',{name:'Save card',exact:true}).click();
  const card=page.getByRole('article',{name:'Studio card A real local QA idea',exact:true}); await expect(card).toBeVisible(); await expect(card.getByRole('button',{name:'Visibility for A real local QA idea',exact:true})).toBeDisabled();
  const linked=page.getByRole('article',{name:'Studio card Fixture: Pixel Planner',exact:true}); await linked.getByRole('button',{name:'Visibility for Fixture: Pixel Planner',exact:true}).click(); await expect(linked.getByRole('button',{name:'Visibility for Fixture: Pixel Planner',exact:true})).toHaveText('Private');
  await (await menu(page,'Card options for A real local QA idea')).getByRole('button',{name:'Delete card',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Confirm deletion',exact:true}).click(); await expect(card).toHaveCount(0);
  await (await menu(page,'Column options for Weekend')).getByRole('button',{name:'Delete column Weekend',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Confirm deletion',exact:true}).click(); await expect(col).toHaveCount(0);
  await (await menu(page,'Column options for Idea')).getByRole('button',{name:'Move column Idea right',exact:true}).click(); await expect(page.getByRole('region',{name:/Column /}).first()).toHaveAccessibleName('Column Develop');
});

test('optimistic move rolls back on WIP refusal and retries without losing the card',async({page})=>{
  await page.goto('/api/dev/login?as=fx-ada'); await page.goto('/studio');
  let release!:()=>void; const gate=new Promise<void>(r=>{release=r;});
  await page.route('**/api/studio/cards/fx_card_1/move',async route=>{await gate;await route.fulfill({status:409,json:{error:{code:'conflict',message:'The target column WIP limit is reached.',details:{wipLimit:1}}}});});
  await (await menu(page,'Card options for Fixture idea: recipe scaler')).getByLabel('Move Fixture idea: recipe scaler',{exact:true}).selectOption('fx_col_3');
  await expect(page.getByRole('region',{name:'Column Bug fix',exact:true})).toContainText('Fixture idea: recipe scaler'); release();
  await expect(page.getByRole('region',{name:'Column Idea',exact:true})).toContainText('Fixture idea: recipe scaler'); await expect(page.getByText('The target column WIP limit is reached.',{exact:true})).toBeVisible();
  await page.unroute('**/api/studio/cards/fx_card_1/move'); await (await menu(page,'Card options for Fixture idea: recipe scaler')).getByLabel('Move Fixture idea: recipe scaler',{exact:true}).selectOption('fx_col_3'); await expect(page.getByText('Card moved.',{exact:true})).toBeVisible();
});

test('board loading, error retry, empty and own unlicensed project',async({page},info)=>{
  await page.goto('/api/dev/login?as=fx-ada'); let release!:()=>void; const gate=new Promise<void>(r=>{release=r;});
  await page.route('**/api/studio/board',async route=>{await gate;await route.fulfill({status:503,json:{error:{code:'unavailable',message:'QA board outage'}}});});
  await page.goto('/studio'); await expect(page.getByText('Loading Studio',{exact:true})).toBeVisible(); await page.screenshot({path:`docs/handoffs/screenshots/2.6-${info.project.name}-loading.png`}); release();
  await expect(page.getByText("Couldn't load your board",{exact:true})).toBeVisible(); await page.screenshot({path:`docs/handoffs/screenshots/2.6-${info.project.name}-error.png`});
  await page.unroute('**/api/studio/board'); await page.route('**/api/studio/board',route=>route.fulfill({json:{id:'qa_empty_board',columns:[],cards:[]}}));
  await page.getByRole('button',{name:'Try again',exact:true}).click(); await expect(page.getByText('No columns yet',{exact:true})).toBeVisible(); await page.screenshot({path:`docs/handoffs/screenshots/2.6-${info.project.name}-empty.png`});
  await page.unroute('**/api/studio/board'); const project=await (await page.request.get('/api/projects/fixture-no-license-notes',{headers:{accept:'application/json'}})).json();
  await page.route('**/api/studio/board',async route=>{const board=await(await route.fetch()).json();board.cards[1].project=project;await route.fulfill({json:board});}); await page.reload();
  await expect(page.getByText('No license: all rights reserved.',{exact:true})).toBeVisible(); await page.screenshot({path:`docs/handoffs/screenshots/2.6-${info.project.name}-no-license.png`});
});

test('keyboard pickup, cancel, cross-column drop and column reorder; desktop mouse drag',async({page},info)=>{
  await page.goto('/api/dev/login?as=fx-ada'); await page.goto('/studio');
  const handle=page.getByRole('button',{name:'Drag card Fixture idea: recipe scaler',exact:true});
  // Wait for sensor activation and target announcements before sending the next key.
  // Fast CI keyboards can otherwise drop before the drag state has committed.
  const announcements=page.getByRole('status').filter({hasText:/Draggable item/});
  await handle.press('Space'); await expect(handle).toHaveAttribute('aria-pressed','true');
  await expect(announcements).toContainText('over droppable area card:fx_card_1');
  await handle.press('ArrowRight'); await expect(announcements).toContainText('over droppable area card:fx_card_2');
  await handle.press('Escape'); await expect(handle).not.toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('region',{name:'Column Idea',exact:true})).toContainText('Fixture idea: recipe scaler');
  await handle.press('Space'); await expect(handle).toHaveAttribute('aria-pressed','true');
  await expect(announcements).toContainText('over droppable area card:fx_card_1');
  await handle.press('ArrowRight'); await expect(announcements).toContainText('over droppable area card:fx_card_2');
  await handle.press('Space');
  await expect(page.getByRole('region',{name:'Column Develop',exact:true})).toContainText('Fixture idea: recipe scaler');
  await expect(page.getByText('Card moved.',{exact:true})).toBeVisible();
  const col=page.getByRole('button',{name:'Drag column Idea',exact:true});
  await col.press('Space'); await expect(col).toHaveAttribute('aria-pressed','true');
  await expect(announcements).toContainText('over droppable area column:fx_col_1');
  await col.press('ArrowRight'); await expect(announcements).toContainText('over droppable area column:fx_col_2');
  await col.press('Space');
  await expect(page.getByRole('region',{name:/Column /}).first()).toHaveAccessibleName('Column Develop');
  if(info.project.name==='desktop') {
    await page.reload(); const from=await page.getByRole('button',{name:'Drag card Fixture idea: recipe scaler',exact:true}).boundingBox(); const to=await page.getByRole('region',{name:'Column Bug fix',exact:true}).boundingBox();
    await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2); await page.mouse.down(); await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:20}); await page.mouse.up();
    await expect(page.getByRole('region',{name:'Column Bug fix',exact:true})).toContainText('Fixture idea: recipe scaler');
  }
});
