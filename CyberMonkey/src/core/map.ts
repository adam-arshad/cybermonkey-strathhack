import type { Point } from './types.ts';
export const MAP = { width: 1000, height: 620 };
export const ROUTE: Point[] = [{x:-35,y:150},{x:200,y:150},{x:200,y:340},{x:475,y:340},{x:475,y:160},{x:755,y:160},{x:755,y:460},{x:1035,y:460}];
export const distance = (a: Point, b: Point) => Math.hypot(a.x-b.x,a.y-b.y);
export function distanceToRoute(p: Point) {
  return Math.min(...ROUTE.slice(1).map((b,i) => {
    const a=ROUTE[i]; const dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
    return distance(p,{x:a.x+t*dx,y:a.y+t*dy});
  }));
}
export const PADS: Point[] = [];
for(let y=65;y<=575;y+=85) for(let x=65;x<=935;x+=85) {
  if(distanceToRoute({x,y})>=53 && !(x>850 && y>335 && y<545)) PADS.push({x,y});
}
const lengths=ROUTE.slice(1).map((p,i)=>distance(p,ROUTE[i]));
export const ROUTE_LENGTH=lengths.reduce((a,b)=>a+b,0);
export function pointOnRoute(progress:number):Point {
  let remaining=Math.max(0,progress);
  for(let i=0;i<lengths.length;i++) {
    if(remaining<=lengths[i]) { const t=remaining/lengths[i]; return {x:ROUTE[i].x+(ROUTE[i+1].x-ROUTE[i].x)*t,y:ROUTE[i].y+(ROUTE[i+1].y-ROUTE[i].y)*t}; }
    remaining-=lengths[i];
  }
  return ROUTE[ROUTE.length-1];
}
