import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, CheckCircle2, ChevronDown, CircleAlert, ClipboardCheck, Clock3, CloudUpload, FilePlus2, FileText, Filter, Keyboard, Loader2, Moon, PackageCheck, Plus, RefreshCcw, Save, Search, ShieldCheck, Sun, Trash2, X } from "lucide-react";
import "./BartDeliveryNotes.css";

const MAX_FILE_MB = 10;
const quantityPattern = /^\s*\d+(?:[.,]\d+)?(?:\s*[a-zA-Z0-9.%/-]+){0,5}\s*$/;
function safeQuantity(v) {
  const text = String(v ?? "").trim();
  return text && text.length <= 65 && !/[\n\r|;]/.test(text) && (text.match(/\b\d+(?:[.,]\d+)?\b/g) || []).length <= 3 && quantityPattern.test(text) ? text : "";
}
function api(path, options={}) {
  return fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}}).then(async res=>{
    const data=await res.json().catch(()=>({}));
    if(!res.ok || data.success===false) throw new Error(data.message||`Request failed (${res.status})`);
    return data;
  });
}
async function imageToJpegBase64(file,maxSide=2200,quality=.88) {
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  return canvas.toDataURL('image/jpeg',quality).split(',')[1];
}
async function detectDocumentGrid(imageBase64) {
  const picture=new Image();picture.src=`data:image/jpeg;base64,${imageBase64}`;await picture.decode();
  const width=picture.naturalWidth,height=picture.naturalHeight;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(picture,0,0);
  const data=ctx.getImageData(0,0,width,height).data;
  const dark=(x,y)=>{const k=(y*width+x)*4;return data[k]*.299+data[k+1]*.587+data[k+2]*.114<145;};
  const step=Math.max(1,Math.round(width/360)),scores=[];
  for(let y=Math.floor(height*.13);y<height*.96;y++){
    let hits=0,total=0;
    for(let x=Math.floor(width*.06);x<width*.95;x+=step){total++;if(dark(x,y)||(y>0&&dark(x,y-1))||(y+1<height&&dark(x,y+1)))hits++;}
    scores[y]=hits/Math.max(1,total);
  }
  const candidates=[];
  for(let y=Math.floor(height*.13);y<height*.96;y++){
    if((scores[y]||0)<.47)continue;
    if(candidates.length&&y-candidates[candidates.length-1].y<=Math.max(3,Math.round(height*.005))){if(scores[y]>candidates[candidates.length-1].score)candidates[candidates.length-1]={y,score:scores[y]};}
    else candidates.push({y,score:scores[y]});
  }
  return {width,height,horizontalRules:candidates.filter(x=>x.score>.47).map(x=>x.y),method:'DARK_PIXEL_HORIZONTAL_RULES'};
}
const normalize=s=>String(s||'').toLowerCase().replace(/\[[^\]]*\]/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
function nameScore(a,b){
  const x=normalize(a),y=normalize(b);if(!x||!y)return 0;if(x===y)return 1;
  const aa=new Set(x.split(' ')),bb=new Set(y.split(' '));
  const shared=[...aa].filter(t=>bb.has(t)).length;
  const token=2*shared/(aa.size+bb.size);
  return Math.min(1,token*.78+((x.includes(y)||y.includes(x)) ? .22 : 0));
}
function formatMatch(r){
  if(r.match==='NAME_CORRECTED')return 'SKU corrected';
  if(r.match==='NAME_MATCH'||r.match==='ITEM_NAME')return 'Name matched';
  if(r.match==='SKU_EXACT')return 'Matched';
  if(r.match==='MANUAL')return 'Staff edited';
  return 'Needs matching';
}
function numberFromQuantity(value){const m=String(value||'').match(/^\s*(\d+(?:[.,]\d+)?)/);return m?Number(m[1].replace(',','.')):null;}
// A blank field is never equivalent to an explicitly entered zero.
function enteredQuantity(value) {
  const v=String(value??'').trim();
  if(!v || !safeQuantity(v))return false;
  const n=numberFromQuantity(v);
  return n!==null && Number.isFinite(n) && n>=0;
}
function rowQuantityIssue(row,documentType) {
  if(documentType==='STOCK_DOCUMENT')return enteredQuantity(row.quantity)&&row.quantityVerified===true?'':'Enter and verify the stock quantity';
  if(!enteredQuantity(row.ordered)||row.orderedVerified!==true)return 'Enter and verify the ordered quantity';
  if(!enteredQuantity(row.delivered)||row.deliveredVerified!==true)return 'Enter and verify the delivered quantity';
  return '';
}
function rowReviewIssue(row,documentType) {
  if(!String(row.item||'').trim())return 'Product name required';
  const qty=rowQuantityIssue(row,documentType);if(qty)return qty;
  if(!row.stockSku && (!row.provisionalReason || !row.reviewedException))return 'Unmatched item: complete guided entry and confirm exception';
  if(row.stockSku && ((row.deliverySku && String(row.deliverySku).trim().toUpperCase()!==String(row.stockSku).trim().toUpperCase()) || (row.printedItem && nameScore(row.printedItem,row.item)<.69)) && !row.reviewedConflict)return 'Printed SKU/name conflict: acknowledge after comparing the photo';
  return '';
}
function unitFromQuantity(value){return String(value||'').replace(/^\s*\d+(?:[.,]\d+)?\s*/, '').trim().toLowerCase();}
function discrepancy(row){
  const a=numberFromQuantity(row.ordered),b=numberFromQuantity(row.delivered);
  if(a===null||b===null||unitFromQuantity(row.ordered)!==unitFromQuantity(row.delivered))return null;
  const delta=b-a;return Math.abs(delta)<.000001?null:{delta,unit:unitFromQuantity(row.delivered)};
}
function expectedPages(text){
  const value=String(text||'').slice(0,9000);
  const match=value.match(/\bpages?\s*[:#-]?\s*(\d{1,2})\s*(?:\/|of)\s*(\d{1,2})\b|(?:^|\n)\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*(?:$|\n)/i);
  if(!match)return null;
  const current=Number(match[1]||match[3]),total=Number(match[2]||match[4]);
  return total>1&&total<=30&&current>=1&&current<=total?{current,total}:null;
}
function highlightFromLines(row,lines,page){
  if(!row||!Array.isArray(lines)||!page?.width||!page?.height)return null;
  const refs=new Set(row.ocrLineIds||[]);
  let match=lines.find(line=>refs.has(line.id));
  if(!match){
    const sku=String(row.deliverySku||row.sku||'').trim().toUpperCase();
    const item=normalize(row.printedItem||row.item);
    match=lines.find(line=>{
      const t=normalize(line.text);
      return (sku.length>2&&t.includes(normalize(sku)))||(item.length>7&&(t.includes(item)||item.includes(t)&&t.length>8));
    });
  }
  const coords=match?.boundingBox;
  if(!Array.isArray(coords)||coords.length<8)return null;
  const xs=coords.filter((_,i)=>i%2===0),ys=coords.filter((_,i)=>i%2===1);
  const left=Math.max(0,Math.min(...xs)/page.width*100),top=Math.max(0,Math.min(...ys)/page.height*100);
  const width=Math.max(0,(Math.max(...xs)-Math.min(...xs))/page.width*100);
  const height=Math.max(0,(Math.max(...ys)-Math.min(...ys))/page.height*100);
  if(![left,top,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
  return {left:`${left}%`,top:`${top}%`,width:`${width}%`,height:`${height}%`};
}
const emptyNote={deliveryNoteNo:'',deliveryDate:'',supplier:'',orderType:'',submittedBy:''};
const ORDER_TYPES=['Dry Order','Food Order','Bakery Order'];
export default function BartDeliveryNotes({branch,onBack,brand="bart"}){
  const deliveryBrand = ["bart","glor","mooma"].includes(brand) ? brand : "bart";
  const deliveryApiBase = `/api/staff/${deliveryBrand}/delivery-notes`;
  const branchCode=String(branch?.code||branch?.BranchCode||branch?.branchCode||'').trim().toUpperCase();
  const storageKey=`dam-delivery-v3:${branchCode}`;
  const historyKey=`dam-delivery-history-v3:${branchCode}`;
  const inputRef=useRef(null);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('dam-delivery-theme')||'light';}catch{return 'light';}});
  const [pendingFile,setPendingFile]=useState(null),[pendingPreview,setPendingPreview]=useState('');
  const [pages,setPages]=useState([]),[previewPage,setPreviewPage]=useState(0);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [submitted,setSubmitted]=useState(null),[usage,setUsage]=useState({used:0,remaining:3,limit:3,loading:true});
  const [rows,setRows]=useState([]),[note,setNote]=useState(emptyNote),[documentType,setDocumentType]=useState('DELIVERY_NOTE');
  const [master,setMaster]=useState([]),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[showTranscript,setShowTranscript]=useState(false);
  const [restored,setRestored]=useState(false);
  const [selectedRow,setSelectedRow]=useState(null);
  const [history,setHistory]=useState([]);
  const [showHistory,setShowHistory]=useState(false);
  const [duplicateState,setDuplicateState]=useState(null);
  const [checkingDuplicate,setCheckingDuplicate]=useState(false);
  const [previewScale,setPreviewScale]=useState(1);
  const [paneWidth,setPaneWidth]=useState(40);
  const reviewRowRefs=useRef({});
  const orderTypeRef=useRef(null),staffNameRef=useRef(null);
  const [newRowId,setNewRowId]=useState(null);
  const [reviewOpen,setReviewOpen]=useState(false);
  const [pickerRow,setPickerRow]=useState(null);
  const [pickerSearch,setPickerSearch]=useState('');
  const pickerRef=useRef(null);
  const finalReviewRef=useRef(null);
  const masterBySku=useMemo(()=>new Map(master.map(m=>[String(m.sku||'').trim().toUpperCase(),m])),[master]);
  const unresolved=rows.filter(r=>!!rowReviewIssue(r,documentType)).length;
  const incompleteQuantity=rows.filter(r=>!!rowQuantityIssue(r,documentType)).length;
  const exceptionCount=rows.filter(r=>!r.stockSku).length;
  const flagged=rows.filter(r=>!!rowReviewIssue(r,documentType)||r.match==='NAME_CORRECTED'||r.match==='SKU_NAME_CONFLICT').length;
  const scanLimitReached=!usage.loading&&usage.remaining<=0;
  const pageHints=pages.map(p=>p.pageHint).filter(Boolean);
  const expectedCount=pageHints.length?Math.max(...pageHints.map(x=>x.total)):null;
  const observedPageNumbers=new Set(pageHints.map(x=>x.current));
  const missingPageNumbers=expectedCount?Array.from({length:expectedCount},(_,i)=>i+1).filter(x=>!observedPageNumbers.has(x)):[];
  const missingPages=false; // A printed page count is informational; staff may submit the uploaded pages.
  const selected=rows.find(r=>r.rowId===selectedRow)||null;
  const selectedPage=pages.find(p=>p.pageNo===(selected?.pageNo||pages[previewPage]?.pageNo));
  const highlight=highlightFromLines(selected,selectedPage?.ocrLines,selectedPage);
  const progress=rows.length?Math.round(100*(rows.length-unresolved)/rows.length):0;
  const pickerMatches=useMemo(()=>{
    if(pickerRow===null)return [];
    const row=rows[pickerRow];if(!row)return [];
    const q=String(pickerSearch||'').trim().toLowerCase();
    const candidates=master.filter(m=>m?.item && (q?([m.sku,m.item,m.uom].join(' ').toLowerCase().includes(q)):true));
    return candidates.sort((a,b)=>nameScore(row.printedItem||row.item,b.item)-nameScore(row.printedItem||row.item,a.item)).slice(0,60);
  },[master,rows,pickerRow,pickerSearch]);
  const visibleRows=rows.map((r,i)=>({...r,_index:i})).filter(r=>(filter==='all'||(filter==='review'?!!rowReviewIssue(r,documentType):!!rowReviewIssue(r,documentType)||r.match==='NAME_CORRECTED'))&&(!search||[r.sku,r.deliverySku,r.item,r.uom].join(' ').toLowerCase().includes(search.toLowerCase())));

  useEffect(()=>{
    if(pickerRow===null)return;
    const timer=window.setTimeout(()=>pickerRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
    return()=>window.clearTimeout(timer);
  },[pickerRow]);
  useEffect(()=>{if(reviewOpen){const id=window.setTimeout(()=>finalReviewRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),80);return()=>window.clearTimeout(id);}},[reviewOpen]);
  useEffect(()=>{try{localStorage.setItem('dam-delivery-theme',theme);}catch{}},[theme]);
  useEffect(()=>{
    let live=true;
    if(!branchCode)return;
    api(`${deliveryApiBase}/scan-status?branch=${encodeURIComponent(branchCode)}`).then(d=>live&&setUsage({used:d.used||0,remaining:d.remaining??3,limit:d.limit||3,loading:false})).catch(e=>{if(live){setUsage(s=>({...s,loading:false}));setError(e.message);}});
    api(`${deliveryApiBase}/stock-master?branch=${encodeURIComponent(branchCode)}`).then(d=>live&&setMaster(d.items||[])).catch(e=>live&&setError(`Stock master unavailable: ${e.message}`));
    try{setHistory(JSON.parse(localStorage.getItem(historyKey)||'[]'));}catch{}
    try{const raw=localStorage.getItem(storageKey);if(raw){const d=JSON.parse(raw);if(Array.isArray(d.rows)&&d.rows.length){setRows(d.rows);setPages((d.pages||[]).map(p=>({...p,preview:''})));setNote(d.note||emptyNote);setSelectedRow(d.selectedRow||null);setDocumentType(d.documentType||'DELIVERY_NOTE');setRestored(true);}}}catch{}
    return()=>{live=false;};
  },[branchCode,storageKey]);
  useEffect(()=>{
    if(!branchCode||submitted)return;
    try{if(rows.length)localStorage.setItem(storageKey,JSON.stringify({rows,pages:pages.map(({preview,...rest})=>rest),note,documentType,selectedRow}));else localStorage.removeItem(storageKey);}catch{}
  },[rows,pages,note,documentType,selectedRow,storageKey,branchCode,submitted]);

  function chooseFile(e){
    const f=e.target.files?.[0];e.target.value='';if(!f)return;
    if(scanLimitReached)return setError('Daily scan limit reached. Contact the IT Team.');
    if(!f.type.startsWith('image/'))return setError('Choose a photo of the delivery note.');
    if(f.size>MAX_FILE_MB*1024*1024)return setError(`Maximum image size is ${MAX_FILE_MB} MB.`);
    setPendingFile(f);setPendingPreview(URL.createObjectURL(f));setError('');setMessage('');
  }
  async function scanPage(){
    if(!pendingFile||!branchCode||busy||scanLimitReached)return;
    setBusy(true);setError('');setMessage('Reading document and preparing product rows…');
    try{
      const imageBase64=await imageToJpegBase64(pendingFile);
      const imageGrid=await detectDocumentGrid(imageBase64).catch(()=>null);
      const d=await api(`${deliveryApiBase}/scan`,{method:'POST',body:JSON.stringify({branch:branchCode,imageBase64,imageGrid})});
      if(d.scanUsage)setUsage({...d.scanUsage,loading:false});
      const type=d.documentType||'DELIVERY_NOTE';
      if(pages.length&&type!==documentType)throw new Error('Cannot combine different document types. Start a new transaction.');
      setDocumentType(type);
      const pageNo=pages.length+1;
      const next=(d.items||[]).map((r,i)=>({...r,reviewedException:false,reviewedConflict:false,provisionalReason:'',rowId:`P${pageNo}-${r.rowId||i+1}`,pageNo,
        deliverySku:r.deliverySku??r.sku??'',printedItem:r.printedItem??r.item??'',uom:r.uom||'',
        suggestedOrdered:safeQuantity(r.ordered),suggestedDelivered:safeQuantity(r.delivered),suggestedQuantity:safeQuantity(r.quantity),
        ordered:'',delivered:'',quantity:'',orderedVerified:false,deliveredVerified:false,quantityVerified:false,status:'REVIEW',
        originalFields:{sku:r.sku||'',item:r.item||'',ordered:r.ordered||'',delivered:r.delivered||'',quantity:r.quantity||'',detailedQty:r.detailedQty||'',expireDate:r.expireDate||''}}));
      setRows(old=>[...old,...next]);if(!selectedRow&&next.length)setSelectedRow(next[0].rowId);
      setPages(old=>[...old,{pageNo,preview:pendingPreview,ocrText:d.ocrText||'',originalOcrText:d.ocrText||'',ocrLines:d.ocrLines||[],width:d.ocrPageDimensions?.width||0,height:d.ocrPageDimensions?.height||0,pageHint:expectedPages(d.ocrText),itemCount:next.length}]);
      setPreviewPage(pages.length);setPendingFile(null);setPendingPreview('');
      setNote(n=>({...n,deliveryNoteNo:n.deliveryNoteNo||d.meta?.deliveryNoteNo||'',deliveryDate:n.deliveryDate||d.meta?.deliveryDate||'',supplier:n.supplier||d.meta?.supplier||''}));
      setRestored(false);setMessage(`Page ${pageNo} added. ${next.length} product rows ready for staff verification.`);
    }catch(e){setError(e.message);setMessage('');}finally{setBusy(false);}
  }
  useEffect(()=>{
    if(selected?.pageNo){const ix=pages.findIndex(p=>p.pageNo===selected.pageNo);if(ix>=0)setPreviewPage(ix);}
  },[selectedRow]);
  useEffect(()=>{
    if(!note.deliveryNoteNo.trim()||!branchCode){setDuplicateState(null);return;}
    let active=true;
    const timer=setTimeout(async()=>{
      setCheckingDuplicate(true);
      try{const d=await api(`${deliveryApiBase}/preflight?branch=${encodeURIComponent(branchCode)}&note=${encodeURIComponent(note.deliveryNoteNo.trim())}`);
        if(active)setDuplicateState(d.duplicate?'duplicate':'clear');
      }catch{if(active)setDuplicateState('unknown');}
      finally{if(active)setCheckingDuplicate(false);}
    },650);
    return()=>{active=false;clearTimeout(timer);};
  },[branchCode,note.deliveryNoteNo]);
  function selectRow(r){setSelectedRow(r.rowId);const ix=pages.findIndex(p=>p.pageNo===r.pageNo);if(ix>=0)setPreviewPage(ix);}
  function focusNext(index){
    const next=rows.findIndex((r,i)=>i>index&&r.status!=='CONFIRMED');
    const first=next>=0?next:rows.findIndex(r=>r.status!=='CONFIRMED');
    if(first>=0){setSelectedRow(rows[first].rowId);setFilter('all');setSearch('');setTimeout(()=>{reviewRowRefs.current[rows[first].rowId]?.scrollIntoView?.({behavior:'smooth',block:'nearest'});reviewRowRefs.current[rows[first].rowId]?.querySelector('input:not([readonly])')?.focus?.();},50);}
  }
  function applyMaster(index,stock,match='MANUAL'){
    setReviewOpen(false);
    setRows(old=>old.map((r,i)=>i!==index?r:{...r,sku:stock.sku,stockSku:stock.sku,item:stock.item,uom:stock.uom||'',match,reviewedConflict:false,reviewedException:false,provisionalReason:'',status:'REVIEW',reviewReason:'Staff selected catalog product'}));
    setPickerRow(null);setPickerSearch('');setError('');
  }
  function updateRow(index,field,value){
    setReviewOpen(false);
    setRows(old=>old.map((r,i)=>{
      if(i!==index)return r;
      const next={...r,[field]:value,status:'REVIEW'};
      if(['ordered','delivered','quantity'].includes(field))next[`${field}Verified`]=true;
      if(field==='sku'){
        const match=masterBySku.get(String(value||'').trim().toUpperCase());
        if(match){next.stockSku=match.sku;next.item=match.item;next.uom=match.uom||'';next.match='SKU_EXACT';next.reviewedConflict=false;next.reviewedException=false;next.provisionalReason='';}
        else {next.stockSku='';next.uom='';next.match='UNMATCHED';} // Preserve item name, never erase it.
      }
      if(field==='item'){
        next.match='MANUAL';next.stockSku='';next.uom='';next.reviewedException=false;next.provisionalReason='';
      }
      return next;
    }));
  }
  function confirmRow(index){
    const r=rows[index];if(!r||!String(r.item||'').trim())return setError('Enter a product name before confirming. Unmatched SKUs and empty quantities may remain blank after staff review.');
    setRows(old=>old.map((x,i)=>i===index?{...x,status:'CONFIRMED',reviewReason:'Staff verified'}:x));setError('');focusNext(index);
  }
  function addRow(){
    setReviewOpen(false);
    const id=`MANUAL-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    setFilter('all');setSearch('');setSelectedRow(id);setNewRowId(id);
    setRows(old=>[...old,{rowId:id,pageNo:pages.length||1,sku:'',deliverySku:'',stockSku:'',item:'',uom:'',ordered:'',delivered:'',quantity:'',detailedQty:'',expireDate:'',match:'MANUAL',status:'REVIEW',orderedVerified:false,deliveredVerified:false,quantityVerified:false,ocrText:''}]);
    setMessage('New item added. Enter the product name.');setError('');
  }
  useEffect(()=>{
    if(!newRowId)return;
    const el=reviewRowRefs.current[newRowId];
    if(!el)return;
    el.scrollIntoView({behavior:'smooth',block:'center'});
    const raf=requestAnimationFrame(()=>el.querySelector('.dnv2-name-field input')?.focus({preventScroll:true}));
    const timeout=window.setTimeout(()=>setNewRowId(null),1000);
    return()=>{cancelAnimationFrame(raf);window.clearTimeout(timeout);};
  },[rows,newRowId,filter,search]);
  function deleteRow(index){
    setReviewOpen(false);if(!busy&&window.confirm('Remove this product row? Only delete rows that are not actual delivery items.'))setRows(old=>old.filter((_,i)=>i!==index));}
  function removePage(pageNo){if(busy||!window.confirm(`Remove page ${pageNo} and its items?`))return;const photo=pages.find(p=>p.pageNo===pageNo)?.preview;if(photo?.startsWith('blob:'))URL.revokeObjectURL(photo);setPages(old=>old.filter(p=>p.pageNo!==pageNo));setRows(old=>old.filter(r=>r.pageNo!==pageNo));setPreviewPage(0);}
  async function reparse(){
    if(!pages.length)return;
    setBusy(true);setError('');
    try{
      const updated=[];
      for(const page of pages){
        if(page.ocrText===page.originalOcrText){updated.push(...rows.filter(r=>r.pageNo===page.pageNo));continue;}
        const d=await api(`${deliveryApiBase}/reparse`,{method:'POST',body:JSON.stringify({branch:branchCode,documentType,ocrText:page.ocrText})});
        if(!(d.items||[]).length)throw new Error(`Page ${page.pageNo}: No product rows were detected. Keep the current rows and edit them manually.`);
        updated.push(...d.items.map((r,i)=>({...r,pageNo:page.pageNo,rowId:`EDIT-P${page.pageNo}-${i+1}`,status:'REVIEW',suggestedOrdered:safeQuantity(r.ordered),suggestedDelivered:safeQuantity(r.delivered),ordered:'',delivered:'',orderedVerified:false,deliveredVerified:false,quantityVerified:false})));
      }
      setRows(updated);setMessage('Updated transcription applied. Review all product rows.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function submit(){
    if(!rows.length||!pages.length)return setError('Add and verify a document before submission.');
    if(!note.deliveryNoteNo.trim())return setError('Delivery Note No is required.');
    if(!ORDER_TYPES.includes(String(note.orderType||'').trim())){
      setError('Select Dry Order, Food Order or Bakery Order before submitting.');
      orderTypeRef.current?.scrollIntoView({behavior:'smooth',block:'center'});
      orderTypeRef.current?.focus({preventScroll:true});return;
    }
    if(!String(note.submittedBy||'').trim()){
      setError('Your name must be entered before submitting this delivery note.');
      staffNameRef.current?.scrollIntoView({behavior:'smooth',block:'center'});
      staffNameRef.current?.focus({preventScroll:true});return;
    }
    if(duplicateState==='duplicate')return setError('This delivery note was already submitted for this branch.');
    if(unresolved){
      const first=rows.find(r=>rowReviewIssue(r,documentType));
      setFilter('all');setSearch('');
      if(first){setSelectedRow(first.rowId);window.setTimeout(()=>reviewRowRefs.current[first.rowId]?.scrollIntoView?.({behavior:'smooth',block:'center'}),70);}
      return setError(`${unresolved} product(s) need attention. ${incompleteQuantity} have missing or invalid quantities. Finish all required fields before submitting.`);
    }
    if(!reviewOpen){setReviewOpen(true);setMessage('Review all items before final submission.');return;}
    if(!window.confirm(`Submit ${rows.length} reviewed products? ${exceptionCount} unmatched item(s) will be recorded as exceptions, not approved catalog products. Confirm quantities and product matches.`))return;
    setBusy(true);setError('');setMessage('Saving verified delivery note…');
    try{
      const feedback=rows.flatMap(r=>!r.originalFields?[]:['sku','item','ordered','delivered','quantity','detailedQty','expireDate'].filter(k=>String(r.originalFields[k]||'').trim()&&String(r.originalFields[k]||'').trim()!==String(r[k]||'').trim()).map(field=>({sku:r.sku,field,before:r.originalFields[field],after:r[field]})));
      const d=await api(`${deliveryApiBase}/submit`,{method:'POST',body:JSON.stringify({branch:branchCode,...note,documentType,pageCount:pages.length,ocrPages:pages.map(p=>p.ocrText),items:rows.map(r=>({...r,status:'CONFIRMED'})),feedback})});
      try{
        localStorage.removeItem(storageKey);
        const entry={deliveryNoteNo:note.deliveryNoteNo,transactionId:d.transactionId||'',orderType:note.orderType,submittedBy:note.submittedBy.trim(),itemCount:rows.length,pageCount:pages.length,date:new Date().toISOString()};
        const updated=[entry,...history].slice(0,20);
        localStorage.setItem(historyKey,JSON.stringify(updated));setHistory(updated);
      }catch{}
      pages.forEach(p=>{if(p.preview?.startsWith('blob:'))URL.revokeObjectURL(p.preview);});
      setSubmitted({deliveryNoteNo:note.deliveryNoteNo,transactionId:d.transactionId||''});setRows([]);setPages([]);setMessage('');
      window.setTimeout(()=>onBack?.(),3000);
    }catch(e){setError(e.message);setMessage('');}finally{setBusy(false);}
  }
  if(submitted)return <main className={`dnv2 theme-${theme}`}><div className="dnv2-success"><CheckCircle2 size={76}/><h1>Delivery note submitted</h1><p>Saved as one verified transaction.</p><strong>{submitted.deliveryNoteNo}</strong>{submitted.transactionId&&<small>Transaction: {submitted.transactionId}</small>}<p>Returning to Staff Dashboard…</p></div></main>;
  return <main className={`dnv2 theme-${theme}`}>
    <div className="dnv2-orb dnv2-orb-a"/><div className="dnv2-orb dnv2-orb-b"/>
    <div className="dnv2-container">
      <header className="dnv2-header"><div className="dnv2-header-left"><button className="dnv2-iconbtn" onClick={onBack} title="Back to dashboard"><ArrowLeft size={19}/></button><div className="dnv2-brand-icon"><PackageCheck size={23}/></div><div><div className="dnv2-eyebrow">DAM OPERATIONS / RECEIVING</div><h1>Delivery Note Workspace</h1><p>{branchCode} · {branch?.name||branch?.BranchName||'BART Branch'}</p></div></div><div className="dnv2-header-right"><span className="dnv2-live"><span/> Secure verification</span><button className="dnv2-theme" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} title="Switch appearance">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>} <span>{theme==='dark'?'Light':'Dark'} mode</span></button></div></header>
      <section className="dnv2-stats"><div className="dnv2-stat"><div className="dnv2-stat-icon blue"><FileText size={21}/></div><div><span>Products detected</span><strong>{rows.length}</strong><small>Across {pages.length} page{pages.length===1?'':'s'}</small></div></div><div className="dnv2-stat"><div className="dnv2-stat-icon green"><ShieldCheck size={21}/></div><div><span>Ready for review</span><strong>{rows.length-unresolved}</strong><small>{progress}% complete</small></div></div><div className="dnv2-stat"><div className="dnv2-stat-icon amber"><CircleAlert size={21}/></div><div><span>Missing details</span><strong>{unresolved}</strong><small>{incompleteQuantity} quantity fields incomplete · {flagged} require review</small></div></div><div className="dnv2-stat"><div className="dnv2-stat-icon cyan"><Camera size={21}/></div><div><span>Scans available today</span><strong>{usage.loading?'…':usage.remaining}</strong><small>{usage.used} / {usage.limit} used</small></div></div></section>
      {(message||error||restored)&&<div className={`dnv2-alert ${error?'danger':'notice'}`}>{error?<CircleAlert size={18}/>:<CheckCircle2 size={18}/>}<span>{error||message||(restored?'Recovered an unfinished review. Original photos are not stored locally; re-open the document if you need to compare it.':'')}</span><button onClick={()=>{setError('');setMessage('');setRestored(false);}} title="Dismiss"><X size={16}/></button></div>}
      <section className="dnv2-topgrid"><div className="dnv2-panel dnv2-upload"><div className="dnv2-sectionhead"><div><span className="dnv2-kicker">STEP 01</span><h2>Document pages</h2><p>Photograph or upload each page. All pages belong to one transaction.</p></div><span className="dnv2-counter">{pages.length} added</span></div><input hidden ref={inputRef} type="file" accept="image/*" capture="environment" onChange={chooseFile}/><button className="dnv2-drop" disabled={usage.loading||scanLimitReached||busy} onClick={()=>inputRef.current?.click()}><span className="dnv2-dropicon"><CloudUpload size={27}/></span><strong>{pendingFile?pendingFile.name:pages.length?'Add another document page':'Choose or photograph a delivery note'}</strong><small>JPG, PNG, HEIC where supported · Max 10 MB</small></button>{pendingPreview&&<div className="dnv2-pending"><img src={pendingPreview} alt="New document preview"/><button className="dnv2-button primary" disabled={busy} onClick={scanPage}>{busy?<Loader2 className="dnv2-spin" size={18}/>:<Camera size={18}/>} Process page {pages.length+1}</button></div>}{pages.length>0&&<div className="dnv2-pagechips">{pages.map((p,i)=><div className="dnv2-pagechip" key={p.pageNo}><button onClick={()=>setPreviewPage(i)} className={previewPage===i?'active':''}><FileText size={15}/> Page {p.pageNo} · {p.itemCount} items</button><button onClick={()=>removePage(p.pageNo)} title="Remove page"><X size={14}/></button></div>)}</div>}<div className="dnv2-tip"><ShieldCheck size={16}/> No additional scan is used when editing a detected row.</div></div>
      <div className="dnv2-panel"><div className="dnv2-sectionhead"><div><span className="dnv2-kicker">STEP 02</span><h2>Delivery details</h2><p>Review the document information before submission.</p></div><ClipboardCheck size={22}/></div><div className="dnv2-fields"><label>Delivery note number <input value={note.deliveryNoteNo} onChange={e=>setNote(n=>({...n,deliveryNoteNo:e.target.value}))} placeholder="e.g. CKWH/INT/47503"/></label><label>Delivery date <input type="date" value={note.deliveryDate} onChange={e=>setNote(n=>({...n,deliveryDate:e.target.value}))}/></label><label>Supplier <input value={note.supplier} onChange={e=>setNote(n=>({...n,supplier:e.target.value}))} placeholder="Supplier name"/></label><label>Order type *<select ref={orderTypeRef} required value={note.orderType||''} onChange={e=>setNote(n=>({...n,orderType:e.target.value}))}><option value="">Select order type</option>{ORDER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Submitted by (staff name) *<input ref={staffNameRef} required value={note.submittedBy||''} onChange={e=>setNote(n=>({...n,submittedBy:e.target.value}))} placeholder="Enter your full name"/></label></div><div className="dnv2-progress-label"><span>Item readiness</span><b>{progress}%</b></div><div className="dnv2-progress"><span style={{width:`${progress}%`}}/></div></div></section>
      <section className="dnv2-workspace"><div className="dnv2-workhead"><div><span className="dnv2-kicker">STEP 03 / VERIFICATION</span><h2>Document & product review</h2><p>Enter quantities, correct products when needed, then review everything once.</p></div><div className="dnv2-workactions"><button className="dnv2-button subtle" onClick={addRow}><Plus size={16}/> Add item</button><button className="dnv2-button primary" disabled={busy||!rows.length||duplicateState==='duplicate'||unresolved>0} onClick={submit}><ClipboardCheck size={17}/> Review all & submit</button></div></div>
      
      {duplicateState==='duplicate'&&<div className="dnv3-warning"><CircleAlert size={17}/> This delivery note number already exists for this branch. Submission is blocked.</div>}
      <div className="dnv3-worktoolbar"><span>Document width</span><input aria-label="Document panel width" type="range" min="30" max="55" value={paneWidth} onChange={e=>setPaneWidth(Number(e.target.value))}/><span>{paneWidth}%</span><button className="dnv2-button subtle" onClick={()=>setShowHistory(v=>!v)}><Clock3 size={15}/> Recent submissions</button></div>
      {showHistory&&<section className="dnv3-history"><h3>Recent submissions on this device</h3>{!history.length?<p>No locally recorded submissions yet.</p>:history.map((h,i)=><div key={h.transactionId||i}><strong>{h.deliveryNoteNo}</strong><span>{h.orderType?`${h.orderType} · `:''}{h.submittedBy?`${h.submittedBy} · `:''}{h.itemCount} items · {h.pageCount} pages · {new Date(h.date).toLocaleString()}</span></div>)}<small>Local history is device-specific. Server-side duplicate checks use Google Sheets.</small></section>}
      <div className="dnv2-split" style={{'--dnv3-doc-width':`${paneWidth}%`}}><aside className="dnv2-document"><div className="dnv2-panehead"><div><FileText size={18}/> Original document</div><span>{pages.length?`Page ${pages[previewPage]?.pageNo||1} of ${pages.length}`:'Waiting for upload'}</span></div>{pages.length&&pages[previewPage]?.preview?<div className="dnv3-document-viewport"><div className="dnv3-image-wrap" style={{transform:`scale(${previewScale})`}}><img className="dnv2-documentimage" src={pages[previewPage].preview} alt="Original delivery note"/>{selected?.pageNo===pages[previewPage]?.pageNo&&highlight&&<div className="dnv3-highlight" style={highlight} title="Selected product location"/>}</div></div>:<div className="dnv2-documentempty"><FileText size={40}/><strong>{pages.length?'Document photo not saved':'Your document appears here'}</strong><span>{pages.length?'Draft data is available. The photo is only kept during the current session.':'Upload a photo to compare each item alongside the original.'}</span></div>}{pages.length>0&&<div className="dnv3-zoom"><button onClick={()=>setPreviewScale(z=>Math.max(1,z-.25))} aria-label="Zoom out">−</button><span>{Math.round(previewScale*100)}%</span><button onClick={()=>setPreviewScale(z=>Math.min(2.5,z+.25))} aria-label="Zoom in">+</button></div>}{pages.length>0&&<div className="dnv2-transcript"><button onClick={()=>setShowTranscript(v=>!v)}><span>Document transcription</span><ChevronDown size={16} className={showTranscript?'rotate':''}/></button>{showTranscript&&<><textarea aria-label="Document transcription" value={pages[previewPage]?.ocrText||''} onChange={e=>setPages(old=>old.map((p,i)=>i===previewPage?{...p,ocrText:e.target.value}:p))}/><button className="dnv2-button subtle" disabled={busy} onClick={reparse}><RefreshCcw size={15}/> Apply text corrections</button></>}</div>}</aside>
      <div className="dnv2-review"><div className="dnv2-panehead"><div><ClipboardCheck size={18}/> Product verification</div><span>{rows.length} rows</span></div><div className="dnv2-tools"><div className="dnv2-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product or SKU"/></div><div className="dnv2-filters"><Filter size={16}/>{[['all','All'],['review','To review'],['issues','Attention']].map(([v,label])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{label}</button>)}</div></div>
      {!rows.length?<div className="dnv2-reviewempty"><PackageCheck size={44}/><h3>No products yet</h3><p>After scanning, products appear here for matching and verification.</p></div>:<div className="dnv2-rows">{visibleRows.length===0?<div className="dnv2-reviewempty"><CheckCircle2 size={34}/><p>No products match this filter.</p></div>:visibleRows.map(r=>{
        const i=r._index,delta=discrepancy(r),suggestions=master.filter(m=>nameScore(r.printedItem||r.item,m.item)>.60).sort((a,b)=>nameScore(r.printedItem||r.item,b.item)-nameScore(r.printedItem||r.item,a.item)).slice(0,3);
        return <article ref={el=>{if(el)reviewRowRefs.current[r.rowId]=el;}} onClick={()=>selectRow(r)} className={`dnv2-row ${!rowReviewIssue(r,documentType)?'verified':''} ${selectedRow===r.rowId?'dnv3-selected':''} ${newRowId===r.rowId?'dnv31-new-row':''}`} key={r.rowId||i}><div className="dnv2-rowhead"><div className="dnv2-rowtitle"><span className="dnv2-rownum">{i+1}</span><span className="dnv2-rowpage">Page {r.pageNo||1}</span><span className={`dnv2-status ${String(r.item||'').trim()?'good':'warn'}`}>{String(r.item||'').trim()?<Check size={12}/>:<CircleAlert size={12}/>} {!rowReviewIssue(r,documentType)?'Ready':'Needs review'}</span></div><div className="dnv2-rowbuttons"><button type="button" className="dnv32-find" title="Find or change catalog product" onClick={e=>{e.stopPropagation();setPickerRow(pickerRow===i?null:i);setPickerSearch('');setFilter('all');}}><Search size={15}/> Find / Change Product</button><button title="Remove row" disabled={busy} onClick={()=>deleteRow(i)}><Trash2 size={15}/></button></div></div>
        <div className="dnv2-rowgrid"><label className="dnv2-sku-field">SKU<input value={r.sku||''} onChange={e=>updateRow(i,'sku',e.target.value)} placeholder="Unmatched"/></label><label className="dnv2-name-field">Product name<input value={r.item||''} onChange={e=>updateRow(i,'item',e.target.value)} placeholder="Product description"/></label><label className="dnv2-uom-field">UOM <small>Catalog</small><input value={r.uom||''} readOnly placeholder="—" title="UOM from the DAM item catalog"/></label>{documentType==='STOCK_DOCUMENT'?<><label>Detailed quantity<textarea value={r.detailedQty||''} onChange={e=>updateRow(i,'detailedQty',e.target.value)}/></label><label>Expiry date<textarea value={r.expireDate||''} onChange={e=>updateRow(i,'expireDate',e.target.value)}/></label><label>Quantity * {r.suggestedQuantity&&<small>Scanned: {r.suggestedQuantity} (enter to verify)</small>}<textarea aria-invalid={!enteredQuantity(r.quantity)} value={r.quantity??''} onChange={e=>updateRow(i,'quantity',e.target.value)}/></label></>:<><label className="dnv2-qty-field">ORDERED * {r.suggestedOrdered&&<small>Scanned: {r.suggestedOrdered} (enter to verify)</small>}<input aria-invalid={!enteredQuantity(r.ordered)} value={r.ordered??''} onChange={e=>updateRow(i,'ordered',e.target.value)} placeholder="Enter ordered qty"/></label><label className="dnv2-qty-field">DELIVERED * {r.suggestedDelivered&&<small>Scanned: {r.suggestedDelivered} (enter to verify)</small>}<input aria-invalid={!enteredQuantity(r.delivered)} value={r.delivered??''} onChange={e=>updateRow(i,'delivered',e.target.value)} placeholder="Enter delivered qty"/></label></>}</div>
        <div className="dnv2-rowfooter"><span className={`dnv2-match ${r.stockSku?'matched':'unmatched'}`}>{formatMatch(r)}</span>{r.deliverySku&&r.deliverySku!==r.sku&&<span className="dnv2-original">Printed SKU: {r.deliverySku}</span>}{delta&&<span className="dnv2-shortage">{delta.delta<0?'Shortage':'Excess'}: {Math.abs(delta.delta)} {delta.unit}</span>}{r.crossedOut&&<span className="dnv2-original">Possibly crossed out</span>}{rowReviewIssue(r,documentType)&&<span className="dnv32-review-error">{rowReviewIssue(r,documentType)}</span>}</div>
        {!r.stockSku&&<div className="dnv4-exception" onClick={e=>e.stopPropagation()}>
          <strong><CircleAlert size={15}/> Product not approved in the JSON catalog</strong>
          <p>First compare the original photo and printed SKU, then use Find / Change Product. If it is genuinely missing, record it as a provisional exception. This will NOT add it to the JSON or post it to stock.</p>
          <div className="dnv4-actions"><button type="button" onClick={()=>{setPickerRow(i);setPickerSearch(r.deliverySku||r.printedItem||'');}}>Search JSON again</button><button type="button" onClick={()=>{setPickerRow(i);setPickerSearch('');}}>See all suggestions</button></div>
          <label>Reason for provisional entry *<select value={r.provisionalReason||''} onChange={e=>updateRow(i,'provisionalReason',e.target.value)}><option value="">Select a reason</option><option value="NOT_IN_CATALOG">Not found in JSON catalog</option><option value="UNREADABLE">Unclear printed SKU or name</option><option value="NEW_SUPPLIER_ITEM">New supplier product</option></select></label>
          <label>Document UOM (reference only; not approved catalog UOM)<input value={r.documentUom||''} onChange={e=>updateRow(i,'documentUom',e.target.value)} placeholder="e.g. CTN / 12 PAK"/></label>
          <label className="dnv4-check"><input type="checkbox" checked={!!r.reviewedException} onChange={e=>updateRow(i,'reviewedException',e.target.checked)}/> I checked the original photo and JSON suggestions. Record this as an unmatched exception.</label>
        </div>}
        {r.stockSku&&((r.deliverySku&&String(r.deliverySku).toUpperCase()!==String(r.stockSku).toUpperCase())||(r.printedItem&&nameScore(r.printedItem,r.item)<.69))&&<label className="dnv4-check dnv4-conflict" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={!!r.reviewedConflict} onChange={e=>updateRow(i,'reviewedConflict',e.target.checked)}/> The printed SKU/name may differ from the selected JSON product ({r.stockSku}). I verified the product against the original photo.</label>}
        {pickerRow===i&&<div className="dnv32-picker" ref={pickerRef} onClick={e=>e.stopPropagation()}>
          <div className="dnv32-picker-head"><strong>Find product in stock master</strong><button type="button" onClick={()=>setPickerRow(null)} aria-label="Close product search"><X size={18}/></button></div>
          <label className="dnv32-picker-search"><Search size={17}/><input autoFocus value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} placeholder="Search by SKU or product name"/></label>
          <small>{pickerMatches.length} catalog result(s) shown · Select the correct product to update SKU and UOM.</small>
          <div className="dnv32-picker-results">{pickerMatches.length?pickerMatches.map((m,j)=><button type="button" key={`${m.sku}-${j}`} onClick={()=>applyMaster(i,m,'NAME_MATCH')}><span><b>{m.sku||'—'}</b> {m.item}</span><small>{m.uom||'No catalog UOM'}</small></button>):<p>No matching products. Keep the original row and review manually.</p>}</div>
        </div>}
        {pickerRow!==i&&!r.stockSku&&suggestions.length>0&&<div className="dnv2-suggestions"><small>Possible stock-master matches:</small>{suggestions.map((m,j)=><button type="button" key={`${m.sku}-${j}`} onClick={e=>{e.stopPropagation();applyMaster(i,m,'NAME_MATCH');}} title={`Use ${m.item}`}><Check size={13}/> {m.sku} · {m.item}</button>)}</div>}
      </article>;
      })}</div>}
      <div className="dnv2-reviewfoot"><Keyboard size={15}/> Use Tab to move between fields. Find / Change Product works on mobile and desktop. Review all once before submitting.</div></div></div>
      {reviewOpen&&<section ref={finalReviewRef} className="dnv32-final-review" role="region" aria-label="Final delivery review">
        <div className="dnv32-final-title"><ClipboardCheck size={21}/><div><h3>Final review</h3><p>{rows.length} products · {incompleteQuantity} with missing/invalid quantities · {exceptionCount} provisional exceptions</p></div></div>
        {unresolved>0&&<p className="dnv32-review-error">{unresolved} rows require attention, including {incompleteQuantity} with missing/invalid quantities. Correct them before submission.</p>}
        <p>All ordered and delivered quantities are mandatory (explicit zero is allowed). Unmatched products are recorded only as reviewed exceptions and never added to the JSON catalog.</p>
        <div className="dnv32-review-list">{rows.map((r,i)=><div key={r.rowId||i}><span><b>{i+1}. {r.sku||'No SKU'}</b> · {r.item||'Product name required'}</span><small>{documentType==='STOCK_DOCUMENT'?`Qty: ${r.quantity||'—'}`:`Ordered: ${r.ordered||'—'} · Delivered: ${r.delivered||'—'}`} · {r.uom||'No catalog UOM'}{!r.stockSku?' · Provisional exception':''}{rowReviewIssue(r,documentType)?` · ${rowReviewIssue(r,documentType)}`:''}</small></div>)}</div>
        <div className="dnv4-summary"><strong>Final summary</strong><span>Order: {note.orderType||'Not selected'} · Submitted by: {note.submittedBy||'Not entered'}</span><span>Pages: {pages.length} · Products: {rows.length} · Unmatched exceptions: {exceptionCount}</span><span>Shortages: {rows.filter(r=>discrepancy(r)?.delta<0).length} · Excesses: {rows.filter(r=>discrepancy(r)?.delta>0).length}</span></div><div className="dnv32-final-actions"><button type="button" className="dnv2-button subtle" onClick={()=>setReviewOpen(false)}>Continue editing</button><button type="button" className="dnv2-button primary" disabled={busy||unresolved>0||duplicateState==='duplicate'} onClick={submit}><Save size={17}/> Confirm all & submit</button></div>
      </section>}
      <div className="dnv2-bottom"><div><ShieldCheck size={19}/><span><b>Staff-controlled verification</b><small>No individual confirmations needed. Review all items once before submitting.</small></span></div><button className="dnv2-button primary" disabled={busy||!rows.length||duplicateState==='duplicate'||unresolved>0} onClick={submit}><ClipboardCheck size={18}/> Review all & submit</button></div></section>
    </div>
  </main>;
}
