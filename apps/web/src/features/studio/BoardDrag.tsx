import { createContext, useContext, type ReactNode } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, useDroppable, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Board, BoardCard, BoardColumn } from "@forkvlift/shared";
import { Button } from "@forkvlift/ui";
import { usePreferences } from "../../app/preferences";

const Busy=createContext(false);
export function BoardDrag({board,disabled,move,reorder,children}:{board:Board;disabled:boolean;move:(id:string,col:string,pos:number)=>void;reorder:(ids:string[])=>void;children:ReactNode}) {
  const columns=[...board.columns].sort((a,b)=>a.position-b.position);
  const keyboard:KeyboardCoordinateGetter=(event,{context,currentCoordinates})=>{
    const {active,over,collisionRect,droppableRects}=context;
    if(!active||!collisionRect||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code))return;
    event.preventDefault();
    const isColumn=active.data.current?.kind==='column';
    const current=over?.data.current??active.data.current;
    const colId=String(current?.columnId??'');
    const colIndex=columns.findIndex(c=>c.id===colId);
    let targetId:string|undefined;
    if(isColumn){const next=columns[colIndex+(event.code==='ArrowLeft'?-1:event.code==='ArrowRight'?1:0)];if(next)targetId=`column:${next.id}`;}
    else {
      const adjacent=event.code==='ArrowLeft'?-1:event.code==='ArrowRight'?1:0;
      const col=columns[colIndex+adjacent];
      if(col){const cards=board.cards.filter(c=>c.columnId===col.id).sort((a,b)=>a.position-b.position);const index=Math.max(0,cards.findIndex(c=>`card:${c.id}`===String(over?.id??active.id)));
        const target=adjacent?cards[Math.min(index,cards.length-1)]:cards[index+(event.code==='ArrowUp'?-1:event.code==='ArrowDown'?1:0)];
        targetId=target?`card:${target.id}`:adjacent?`drop:${col.id}`:undefined;}
    }
    const rect=targetId?droppableRects.get(targetId):undefined;
    if(rect)return {x:currentCoordinates.x+rect.left+rect.width/2-collisionRect.left-collisionRect.width/2,y:currentCoordinates.y+rect.top+rect.height/2-collisionRect.top-collisionRect.height/2};
  };
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:keyboard}));
  return <Busy.Provider value={disabled}><DndContext sensors={sensors} collisionDetection={args=>closestCorners({...args,droppableContainers:args.droppableContainers.filter(c=>args.active.data.current?.kind==='column'?c.data.current?.kind==='column':c.data.current?.kind!=='column')})}
    accessibility={{screenReaderInstructions:{draggable:'Press Space to pick up. Use arrow keys to move. Press Space to drop, or Escape to cancel.'}}}
    onDragEnd={({active,over})=>{if(disabled||!over||active.id===over.id)return;const from=active.data.current,to=over.data.current;if(from?.kind==='column'){const ids=columns.map(c=>c.id);const start=ids.indexOf(String(from.columnId)),end=ids.indexOf(String(to?.columnId));if(start<0||end<0)return;ids.splice(end,0,ids.splice(start,1)[0]!);reorder(ids);}else if(from?.kind==='card'&&to?.columnId){const target=board.cards.find(c=>`card:${c.id}`===String(over.id));const pos=target?.position??board.cards.filter(c=>c.columnId===to.columnId&&c.id!==from.cardId).length;move(String(from.cardId),String(to.columnId),pos);}}}>
    <SortableContext items={columns.map(c=>`column:${c.id}`)} strategy={horizontalListSortingStrategy}>{children}</SortableContext>
  </DndContext></Busy.Provider>;
}
export function useColumnDrag(column:BoardColumn){
  const disabled=useContext(Busy),{motionReduced}=usePreferences();
  const sort=useSortable({id:`column:${column.id}`,data:{kind:'column',columnId:column.id},disabled});
  const drop=useDroppable({id:`drop:${column.id}`,data:{kind:'drop',columnId:column.id},disabled});
  return {ref:(node:HTMLElement|null)=>{sort.setNodeRef(node);drop.setNodeRef(node);},style:{transform:sort.transform?`translate3d(${sort.transform.x}px,${sort.transform.y}px,0)`:undefined,transition:motionReduced?undefined:sort.transition},handle:<Button size="sm" variant="ghost" disabled={disabled} {...sort.attributes} {...sort.listeners} aria-label={`Drag column ${column.title}`} className="touch-none">↔</Button>};
}
export function CardSortList({cards,children}:{cards:BoardCard[];children:ReactNode}){return <SortableContext items={cards.map(c=>`card:${c.id}`)} strategy={verticalListSortingStrategy}>{children}</SortableContext>;}
export function DraggableStudioCard({card,children}:{card:BoardCard;children:ReactNode}) {
  const disabled=useContext(Busy),{motionReduced}=usePreferences();
  const sort=useSortable({id:`card:${card.id}`,data:{kind:'card',cardId:card.id,columnId:card.columnId},disabled});
  return <div ref={sort.setNodeRef} style={{transform:sort.transform?`translate3d(${sort.transform.x}px,${sort.transform.y}px,0)`:undefined,transition:motionReduced?undefined:sort.transition}} className={sort.isDragging?'relative z-20 opacity-70':'relative'}>
    <Button size="sm" variant="secondary" disabled={disabled} {...sort.attributes} {...sort.listeners} aria-label={`Drag card ${card.title}`} className="mb-1 touch-none">Move card ↕</Button>{children}</div>;
}
