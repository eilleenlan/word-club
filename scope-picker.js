/* Shared accessible optional selection controls. */
globalThis.makePracticePicker = function(container, items, onChange) {
 const box=document.createElement('details');box.className='practice-picker';
 const summary=document.createElement('summary');summary.textContent='自選範圍';box.append(summary);
 const allLabel=document.createElement('label'), customLabel=document.createElement('label');
 const name='picker-'+Math.random().toString(36).slice(2);
 const all=document.createElement('input'),custom=document.createElement('input');
 all.type=custom.type='radio';all.name=custom.name=name;all.checked=true;
 allLabel.append(all,'全部練習');customLabel.append(custom,'自選範圍');box.append(allLabel,customLabel);
 const area=document.createElement('div');area.hidden=true;const controls=document.createElement('div');
 const select=document.createElement('button'),clear=document.createElement('button');select.type=clear.type='button';select.textContent='全選';clear.textContent='清除';controls.append(select,clear);area.append(controls);
 const selected=new Set(items.map(x=>x.id));const inputs=[];
 const list=document.createElement('div');list.className='picker-list';
 for(const item of items){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=true;input.value=item.id;input.onchange=()=>{input.checked?selected.add(item.id):selected.delete(item.id);update();};label.append(input,document.createTextNode(item.label));list.append(label);inputs.push(input);}
 area.append(list);box.append(area);const status=document.createElement('p');status.setAttribute('role','status');box.append(status);container.append(box);
 const values=()=>all.checked?items.map(x=>x.id):items.filter(x=>selected.has(x.id)).map(x=>x.id);
 function update(){area.hidden=all.checked;status.textContent=`已選 ${values().length}／${items.length} 個目標`;onChange?.(values());}
 all.onchange=custom.onchange=update;select.onclick=()=>{items.forEach(x=>selected.add(x.id));inputs.forEach(x=>x.checked=true);update();};clear.onclick=()=>{selected.clear();inputs.forEach(x=>x.checked=false);update();};
 update();return {values};
};
