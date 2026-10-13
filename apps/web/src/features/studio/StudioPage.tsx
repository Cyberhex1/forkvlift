import { AlreadyBuilt } from "../catalog/AlreadyBuilt";
import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PROJECT_STAGE_LABELS, ProjectStage, NO_LICENSE_DISCLAIMER, type Board, type BoardCard, type BoardColumn } from "@forkvlift/shared";
import { Badge, Button, Card, Modal, Spinner, StateMessage, buttonClasses, cn } from "@forkvlift/ui";
import { useSession, signInUrl } from "../../app/session";
import { api } from "../../lib/api";
import { BoardDrag, DraggableStudioCard, CardSortList, useColumnDrag } from "./BoardDrag";
import { usePreferences } from "../../app/preferences";
import { MenuDivider, MenuItem, StudioMenu } from "./StudioMenu";

export function moveInBoard(board: Board, id: string, columnId: string, position: number): Board {
  const moving = board.cards.find(c => c.id === id);
  if (!moving) return board;
  const others = board.cards.filter(c => c.id !== id);
  const target = others.filter(c => c.columnId === columnId).sort((a,b) => a.position-b.position);
  target.splice(Math.min(position,target.length),0,{ ...moving,columnId });
  const cards = board.columns.flatMap(col => (col.id === columnId ? target : others.filter(c => c.columnId === col.id).sort((a,b) => a.position-b.position)).map((card,i) => ({ ...card,position:i })));
  return { ...board,cards };
}
const input = "mt-1 block w-full rounded-pixel border border-border bg-surface p-2";
export const pixelClasses = ["bg-pixel-0","bg-pixel-1","bg-pixel-2","bg-pixel-3","bg-pixel-4","bg-pixel-5","bg-pixel-6","bg-pixel-7","bg-pixel-8","bg-pixel-9","bg-pixel-10","bg-pixel-11","bg-pixel-12","bg-pixel-13","bg-pixel-14","bg-pixel-15"];
export function StudioPage() {
  const { user,isLoading,error } = useSession();
  const qc = useQueryClient();
  const key = ["studio",user?.id];
  const board = useQuery({ queryKey:key,queryFn:({signal}) => api.call("getBoard",{}, {signal}),enabled:!!user,retry:false,refetchOnWindowFocus:false });
  const projects = useQuery({queryKey:["studio-projects",user?.id], queryFn:()=>api.call("listUserProjects",{params:{username:user!.username},query:{limit:100,showUnlicensed:true}}),enabled:!!user,retry:false});
  const [feedback,setFeedback] = useState("");
  const [adding,setAdding] = useState<string|null>(null);
  const [newColumn,setNewColumn] = useState("");
  const [title,setTitle] = useState("");
  const [idea,setIdea] = useState("");
  const [stage,setStage] = useState<BoardCard["stage"]>("wip");
  const [projectId,setProjectId] = useState("");
  const [editing,setEditing] = useState<BoardCard|null>(null);
  const [deleting,setDeleting] = useState<{type:"column"|"card";id:string;title:string}|null>(null);
  const operation = useMutation({ mutationFn:async (work:()=>Promise<void>) => { setFeedback(""); await work(); },onError:(error)=>setFeedback(error.message) });
  const setBoard = (fn:(board:Board)=>Board) => qc.setQueryData<Board>(key,b=>b ? fn(b):b);
  const run = (work:()=>Promise<void>) => { if(!operation.isPending) operation.mutate(work); };
  const patchColumn = (id:string,body:Partial<Pick<BoardColumn,"title"|"color"|"collapsed"|"wipLimit">>) => run(async()=>{ const col=await api.call("updateColumn",{params:{id},body}); setBoard(b=>({...b,columns:b.columns.map(c=>c.id===id?{...c,...Object.fromEntries(Object.keys(body).map(field=>[field,col[field as keyof BoardColumn]]))}:c)})); });
  const move = (id:string,columnId:string,position:number) => run(async()=>{
    await qc.cancelQueries({queryKey:key}); const before=qc.getQueryData<Board>(key)!;
    setBoard(b=>moveInBoard(b,id,columnId,position));
    try { const card=await api.call("moveCard",{params:{id},body:{columnId,position}}); setBoard(b=>({...b,cards:b.cards.map(c=>c.id===id?card:c)})); setFeedback("Card moved."); }
    catch(error) { qc.setQueryData(key,before); throw error; }
  });
  const reorder = (ids:string[])=>run(async()=>{ const before=qc.getQueryData<Board>(key)!; setBoard(b=>({...b,columns:ids.map((id,position)=>({...b.columns.find(c=>c.id===id)!,position}))})); try{const result=await api.call("reorderColumns",{body:{columnIds:ids}});setBoard(b=>({...b,columns:result.columns}));}catch(error){qc.setQueryData(key,before);throw error;} });
  if(isLoading) return <Spinner label="Loading Studio session"/>;
  if(error) return <StateMessage title="Couldn't load your session" tone="danger" action={<Button onClick={()=>void qc.invalidateQueries({queryKey:["session"]})}>Try again</Button>}/>;
  if(!user) return <StateMessage title="Sign in to your Studio" children="Your board and ideas are private to your account." action={<a className={buttonClasses()} href={signInUrl()}>Sign in with GitHub</a>}/>;
  if(board.isPending) return <Spinner label="Loading Studio"/>;
  if(board.isError) return <StateMessage title="Couldn't load your board" children={board.error.message} tone="danger" action={<Button onClick={()=>void board.refetch()}>Try again</Button>}/>;
  const data=board.data, columns=[...data.columns].sort((a,b)=>a.position-b.position);
  const cardsIn=(columnId:string)=>data.cards.filter(c=>c.columnId===columnId).sort((a,b)=>a.position-b.position);
  const addColumn=()=>run(async()=>{const col=await api.call("createColumn",{body:{title:newColumn.trim()}});setBoard(b=>({...b,columns:[...b.columns,col]}));setNewColumn("");});
  return <div className="min-w-0 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-xl">Studio</h1><p className="text-muted">Plan privately. Publish repository projects when you're ready.</p></div><Link to="/submit" className={buttonClasses("secondary","sm")}>Submit a repository</Link></div>
    <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">{operation.isPending?"Saving…":feedback||"Drag cards by their grip to move them. More options are under ⋯."}</p>{!columns.length?<StateMessage title="No columns yet" children="Add a column to start planning."/>:null}
    <BoardDrag board={data} disabled={operation.isPending} move={move} reorder={reorder}><div className="-mx-1 max-w-full overflow-x-auto px-1 pb-3" aria-label="Studio board"><div className="flex w-max min-w-full items-start gap-3">{columns.map((column,index)=>{const cards=cardsIn(column.id);return <StudioColumn key={column.id} column={column} cards={cards} disabled={operation.isPending} onPatch={body=>patchColumn(column.id,body)} onAdd={()=>{setAdding(column.id);setTitle("");setIdea("");setProjectId("");}} onDelete={()=>setDeleting({type:"column",id:column.id,title:column.title})} onReorder={delta=>{const ids=columns.map(c=>c.id);[ids[index],ids[index+delta]]=[ids[index+delta]!,ids[index]!];reorder(ids);}} index={index} total={columns.length}>
      {cards.map((card,i)=> <DraggableStudioCard key={card.id} card={card}>{handle=> <Card as="article" padded={false} className="space-y-2 p-3" aria-label={`Studio card ${card.title}`}>
        <div className="flex items-start gap-1"><h3 className="min-w-0 flex-1 break-words pt-1 font-display text-sm">{card.title}</h3>{handle}<StudioMenu label={`Card options for ${card.title}`} disabled={operation.isPending}>{close=><>
          <MenuItem onClick={()=>{close();setEditing(card);setTitle(card.title);setIdea(card.idea??"");setStage(card.stage);}}>Edit card</MenuItem>
          <Link className="flex w-full items-center rounded-pixel px-2 py-1.5 hover:bg-surface-2" to={`/studio/cards/${card.id}/plan`}>Open plan</Link>
          <MenuDivider/>
          <label className="block px-2 py-1 text-xs text-muted">Move to column<select aria-label={`Move ${card.title}`} className={cn(input,"text-sm text-fg")} value={card.columnId} disabled={operation.isPending} onChange={e=>{close();move(card.id,e.target.value,data.cards.filter(c=>c.columnId===e.target.value&&c.id!==card.id).length);}}>{columns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
          <MenuItem disabled={operation.isPending||i===0} aria-label={`Move ${card.title} up`} onClick={()=>move(card.id,column.id,i-1)}><span aria-hidden="true">↑</span> Move up</MenuItem>
          <MenuItem disabled={operation.isPending||i===cards.length-1} aria-label={`Move ${card.title} down`} onClick={()=>move(card.id,column.id,i+1)}><span aria-hidden="true">↓</span> Move down</MenuItem>
          <MenuDivider/>
          <MenuItem danger onClick={()=>{close();setDeleting({type:"card",id:card.id,title:card.title});}}>Delete card</MenuItem>
        </>}</StudioMenu></div>
        {card.idea?<p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted">{card.idea}</p>:null}
        {card.project?<Link to={`/p/${encodeURIComponent(card.project.slug)}`} className="flex items-center gap-2 rounded-pixel border border-border bg-surface-2 px-2 py-1.5 text-sm hover:border-accent"><span aria-hidden="true">↗</span><span className="min-w-0 truncate">{card.project.name}</span>{card.project.license?<span className="ml-auto shrink-0 text-xs text-muted">{card.project.license.spdx}</span>:null}</Link>:null}
        {card.project&&!card.project.license?<p className="text-xs text-warning">{NO_LICENSE_DISCLAIMER.title}</p>:null}
        <div className="flex flex-wrap items-center gap-1.5"><Badge tone={card.stage==="finished"?"success":"warning"}>{PROJECT_STAGE_LABELS[card.stage]}</Badge><Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={operation.isPending||!card.project?.repoUrl} title={card.project?undefined:"Ideas without a repository stay private."} aria-label={`Visibility for ${card.title}`} aria-pressed={card.isPublic} onClick={()=>run(async()=>{const updated=await api.call("updateCard",{params:{id:card.id},body:{isPublic:!card.isPublic}});setBoard(b=>({...b,cards:b.cards.map(c=>c.id===card.id?updated:c)}));})}>{card.isPublic?"Public":"Private"}</Button><Link className={buttonClasses("ghost","sm","ml-auto h-6 px-2 text-xs")} to={`/studio/cards/${card.id}/plan`}>Plan</Link></div>
      </Card>}</DraggableStudioCard>)}
    </StudioColumn>;})}
      {columns.length<12?<form className="w-72 shrink-0 rounded-card border border-dashed border-border p-2" onSubmit={e=>{e.preventDefault();addColumn();}}><div className="flex gap-2"><input aria-label="New column" className="min-w-0 flex-1 rounded-pixel border border-border bg-surface px-2 text-sm" placeholder="New column" maxLength={60} value={newColumn} onChange={e=>setNewColumn(e.target.value)} required/><Button size="sm" type="submit" disabled={operation.isPending||!newColumn.trim()}>Add column</Button></div></form>:null}
    </div></div></BoardDrag>
    <Modal open={!!adding||!!editing} onClose={()=>{if(!operation.isPending){setAdding(null);setEditing(null);}}} title={editing?"Edit Studio card":"Add Studio card"}><form className="mt-4 space-y-4" onSubmit={e=>{e.preventDefault();run(async()=>{const updated=editing?await api.call("updateCard",{params:{id:editing.id},body:{title:title.trim(),idea:idea||null,stage}}):await api.call("createCard",{body:{columnId:adding!,title:title.trim(),idea:idea||null,projectId:projectId||null}});setBoard(b=>({...b,cards:editing?b.cards.map(c=>c.id===editing.id?updated:c):[...b.cards,updated]}));setAdding(null);setEditing(null);});}}><label className="block">Card title<input className={input} value={title} maxLength={100} required onChange={e=>setTitle(e.target.value)}/></label><label className="block">Idea<textarea className={input} value={idea} maxLength={1000} onChange={e=>setIdea(e.target.value)}/></label>{!editing&&!projectId?<AlreadyBuilt text={`${title} ${idea}`}/>:null}{editing?<label className="block">Stage<select aria-label="Stage" className={input} value={stage} onChange={e=>setStage(e.target.value as BoardCard["stage"])}>{ProjectStage.options.map(value=><option key={value} value={value}>{PROJECT_STAGE_LABELS[value]}</option>)}</select></label>:null}{!editing?<label className="block">Link one of your projects<select aria-label="Link one of your projects" className={input} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Private idea (no repository)</option>{projects.data?.items.filter(p=>!data.cards.some(c=>c.project?.id===p.id)).map(p=><option key={p.id} value={p.id}>{p.name}{p.license?"":" · No license"}</option>)}</select>{projects.isError?<p role="alert">Couldn't load your projects. You can still save a private idea.</p>:projects.isPending?<p>Loading projects…</p>:null}</label>:null}{feedback?<p role="alert" className="text-danger">{feedback}</p>:null}<Button type="submit" loading={operation.isPending} disabled={!title.trim()}>Save card</Button></form></Modal>
    <Modal open={!!deleting} onClose={()=>{if(!operation.isPending)setDeleting(null);}} title={`Delete ${deleting?.title??"item"}?`}><p className="my-4">{deleting?.type==="column"?"Cards move to the first remaining column. The last column cannot be deleted.":"This removes the Studio card and its plan. The catalog project remains."}</p>{feedback?<p role="alert" className="text-danger">{feedback}</p>:null}<Button variant="danger" loading={operation.isPending} onClick={()=>run(async()=>{const item=deleting!;if(item.type==="card"){await api.call("deleteCard",{params:{id:item.id}});setBoard(b=>({...b,cards:b.cards.filter(c=>c.id!==item.id)}));}else{await api.call("deleteColumn",{params:{id:item.id}});setBoard(b=>{const rest=b.columns.filter(c=>c.id!==item.id).sort((a,b)=>a.position-b.position);const first=rest[0]!;const current=b.cards.filter(c=>c.columnId===first.id);return {...b,columns:rest.map((c,position)=>({...c,position})),cards:b.cards.map(c=>c.columnId===item.id?{...c,columnId:first.id,position:current.length+c.position}:c)};});}setDeleting(null);})}>Confirm deletion</Button></Modal>
  </div>;
}
function StudioColumn({column,cards,disabled,onPatch,onAdd,onDelete,onReorder,index,total,children}:{column:BoardColumn;cards:BoardCard[];disabled:boolean;onPatch:(body:Partial<BoardColumn>)=>void;onAdd:()=>void;onDelete:()=>void;onReorder:(delta:number)=>void;index:number;total:number;children:React.ReactNode}) {
  const [renaming,setRenaming]=useState(false),[name,setName]=useState(column.title);
  const { motionReduced }=usePreferences();
  const drag=useColumnDrag(column);
  const color=pixelClasses[Number(column.color?.replace("pixel-",""))]??"bg-accent";
  const full=!!column.wipLimit&&cards.length>=column.wipLimit;
  const count=<Badge tone={full?"warning":"neutral"}>{column.wipLimit?`${cards.length}/${column.wipLimit}`:cards.length}</Badge>;
  if(column.collapsed) return <section ref={drag.ref} style={drag.style} className="flex w-12 shrink-0 flex-col items-center gap-2 rounded-card border border-border bg-surface pb-3" aria-label={`Column ${column.title}`} data-motion-reduced={motionReduced}>
    <div className={cn("h-1 w-full rounded-t-card",color)}/><Button size="sm" variant="ghost" className="h-7 w-7 px-0" disabled={disabled} title="Expand" onClick={()=>onPatch({collapsed:false})} aria-label={`Expand ${column.title}`}><span aria-hidden="true">›</span></Button>{drag.handle}{count}
    <span className="font-display text-sm [writing-mode:vertical-rl]">{column.title}</span>
  </section>;
  return <section ref={drag.ref} style={drag.style} className="flex w-72 shrink-0 flex-col rounded-card border border-border bg-surface" aria-label={`Column ${column.title}`} data-motion-reduced={motionReduced}>
    <div className={cn("h-1 rounded-t-card",color)}/>
    <header className="flex items-center gap-1 px-2 pt-2">{drag.handle}
      {renaming?<form className="flex min-w-0 flex-1 gap-1" onSubmit={e=>{e.preventDefault();if(name.trim()){onPatch({title:name.trim()});setRenaming(false);}}}><input aria-label={`Rename ${column.title}`} className="min-w-0 flex-1 rounded-pixel border border-border bg-surface px-2 text-sm" autoFocus value={name} maxLength={60} required onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Escape")setRenaming(false);}}/><Button type="submit" size="sm" disabled={disabled}>Rename</Button></form>
      :<button className="min-w-0 flex-1 truncate rounded-pixel px-1 text-left font-display text-sm hover:text-accent" title="Rename" disabled={disabled} onClick={()=>{setName(column.title);setRenaming(true);}} aria-label={`Rename ${column.title}`}>{column.title}</button>}
      {renaming?null:count}
      <Button size="sm" variant="ghost" className="h-7 w-7 px-0" disabled={disabled} title="Collapse" onClick={()=>onPatch({collapsed:true})} aria-label={`Collapse ${column.title}`}><span aria-hidden="true">‹</span></Button>
      <StudioMenu label={`Column options for ${column.title}`} disabled={disabled} width={248}>{close=><>
        <MenuItem onClick={()=>{close();setName(column.title);setRenaming(true);}}>Rename column</MenuItem>
        <MenuDivider/>
        <p className="px-2 pt-1 text-xs text-muted">Color</p>
        <div className="grid grid-cols-9 gap-1 p-2" role="group" aria-label={`Color for ${column.title}`}>
          <button type="button" aria-label="Default color" aria-pressed={!column.color} disabled={disabled} onClick={()=>onPatch({color:null})} className={cn("h-5 w-5 rounded-pixel border border-border bg-accent",!column.color&&"ring-2 ring-fg ring-offset-1 ring-offset-surface")}/>
          {pixelClasses.map((cls,i)=><button key={i} type="button" aria-label={`Pixel ${i}`} aria-pressed={column.color===`pixel-${i}`} disabled={disabled} onClick={()=>onPatch({color:`pixel-${i}`})} className={cn("h-5 w-5 rounded-pixel border border-border",cls,column.color===`pixel-${i}`&&"ring-2 ring-fg ring-offset-1 ring-offset-surface")}/>)}
        </div>
        <label className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted">Card limit (WIP)<input className="w-20 rounded-pixel border border-border bg-surface p-1 text-sm text-fg" aria-label={`WIP limit for ${column.title}`} type="number" min={1} max={500} placeholder="None" key={column.wipLimit} defaultValue={column.wipLimit??""} disabled={disabled} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} onBlur={e=>{const n=e.target.value?Number(e.target.value):null;if(n!==column.wipLimit&&(n===null||Number.isInteger(n)&&n>0))onPatch({wipLimit:n});}}/></label>
        <MenuDivider/>
        <MenuItem disabled={disabled||index===0} onClick={()=>{close();onReorder(-1);}} aria-label={`Move column ${column.title} left`}><span aria-hidden="true">←</span> Move left</MenuItem>
        <MenuItem disabled={disabled||index===total-1} onClick={()=>{close();onReorder(1);}} aria-label={`Move column ${column.title} right`}><span aria-hidden="true">→</span> Move right</MenuItem>
        <MenuDivider/>
        <MenuItem danger disabled={disabled||total===1} onClick={()=>{close();onDelete();}} aria-label={`Delete column ${column.title}`}>Delete column</MenuItem>
      </>}</StudioMenu>
    </header>
    {full?<p role="status" className="mx-3 mt-1 text-xs text-warning">WIP limit reached · {cards.length}/{column.wipLimit}</p>:null}
    <CardSortList cards={cards}><div className="flex min-h-14 flex-col gap-2 p-2">{cards.length?children:<p className="rounded-pixel border border-dashed border-border p-3 text-center text-sm text-muted">No cards here yet.</p>}</div></CardSortList>
    <div className="px-2 pb-2"><Button size="sm" variant="ghost" className="w-full justify-start text-muted hover:text-fg" disabled={disabled} onClick={onAdd}><span aria-hidden="true">+</span>Add card</Button></div>
  </section>;
}
