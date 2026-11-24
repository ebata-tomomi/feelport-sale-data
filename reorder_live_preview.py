"""Read-only live catalogue preview. Never publishes or changes BASE."""
import base64,json,os,urllib.request
from datetime import datetime
from pathlib import Path
from preview_sale import API,JST,integer,parse_date
from feelport_reorder_feed import build
from decision_adapter import CHOICES,attach_decisions
from feelport_reorder_rank_v4 import plan

def get_items(token):
    """Request BASE list order explicitly; preserve response sequence."""
    result={}
    for offset in range(0,10000,100):
        req=urllib.request.Request(f'{API}?limit=100&offset={offset}&order=list_order&sort=asc',headers={'Authorization':'Bearer '+token,'Accept':'application/json'})
        with urllib.request.urlopen(req,timeout=45) as response:
            page=json.load(response)
        if not isinstance(page,list) or len(page)>100:
            raise ValueError('Unexpected BASE item list')
        for item in page:
            if not isinstance(item,dict) or not str(item.get('id','')).isdigit():
                raise ValueError('Invalid BASE item ID')
            pid=str(item['id'])
            if pid in result:raise ValueError('Duplicate BASE item ID; catalogue changed')
            result[pid]=dict(item,_reorder_index=len(result))
        if len(page)<100:return result
    raise ValueError('BASE pagination limit exceeded')

def decode(value):
    data=json.loads(base64.b64decode(value,validate=True).decode())
    if not isinstance(data,dict) or any(not k.isascii() or not k.isdigit() or not isinstance(v,str) or v not in CHOICES for k,v in data.items()):
        raise ValueError('Invalid decision data')
    return {k:CHOICES[v] for k,v in data.items()}

def generate(items,decisions,today):
    export={}
    active=[(pid,i) for pid,i in items.items() if i.get('visible') is True and integer(i.get('stock'))]
    for pid,i in active:
        title=i.get('title') or i.get('name') or i.get('item_name')
        if not isinstance(title,str) or not title.strip() or parse_date(i.get('created_at')) is None:
            raise ValueError('Active item missing title or creation date')
        order=i.get('_reorder_index')
        if order is None: raise ValueError('Active item missing ordered response index')
        export[str(pid)]={'商品名':title,'export_index':int(order)}
    feed=attach_decisions(build(items,export,today),decisions)
    feed['catalog']=[r for r in feed['catalog'] if r['days']<120 or r['continued']]
    result=plan(feed,{})
    return {'as_of':result['as_of'],'priority_ids':result['priority_ids'],'active_count':len(active),'eligible_count':len(feed['catalog']),'decision_warnings':feed['decision_warnings'],'warnings':result['warnings']}

def main():
    decisions=decode(os.environ['FEELPORT_REORDER_DECISIONS_B64'])
    result=generate(get_items(os.environ['BASE_ACCESS_TOKEN']),decisions,datetime.now(JST).date())
    out=Path('reorder_results');out.mkdir(exist_ok=True)
    (out/'reorder_preview.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print('Active:',result['active_count'],'Eligible:',result['eligible_count'],'Priority:',len(result['priority_ids']))
    print('READ ONLY: no BASE or publication writes')
if __name__=='__main__':main()
