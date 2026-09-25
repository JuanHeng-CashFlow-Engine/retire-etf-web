type Income = {name?:string;category?:string;start_month?:string;end_month?:string|null;monthly_amount?:unknown}
export function possibleIncomeDuplicates(rows: Income[]) {
  const groups=new Map<string,Income[]>()
  for(const row of rows) {
    const name=String(row.name||'').normalize('NFKC').replace(/\s/g,'').toLowerCase()
    if(!name)continue
    const key=JSON.stringify([name,row.category,row.start_month,row.end_month??null,Number(row.monthly_amount)])
    groups.set(key,[...(groups.get(key)||[]),row])
  }
  return [...groups.values()].filter(rows=>rows.length>1).map(rows=>({type:'possible_duplicate',name:rows[0].name,count:rows.length,ignored_count:0,note:'名稱、類別、起迄日期與金額相同，請核對是否重複；本次仍納入全部有效收入，未自動排除。'}))
}
