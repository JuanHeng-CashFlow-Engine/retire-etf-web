// Compatibility endpoint: all requests use the canonical authenticated Pro handler.
// Never forward a service-role credential on behalf of a browser.
const cors={'Access-Control-Allow-Origin':'https://juanheng-cashflow-engine.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return Response.json({error:'method not allowed'},{status:405,headers:cors});
  try {
    const response=await fetch(Deno.env.get('SUPABASE_URL')+'/functions/v1/financial-analysis-auth',{
      method:'POST',headers:{Authorization:req.headers.get('authorization')||'',apikey:Deno.env.get('SUPABASE_ANON_KEY')||'',Origin:req.headers.get('origin')||'','Content-Type':'application/json'},
      body:await req.text()
    });
    return new Response(response.body,{status:response.status,headers:{...cors,'Content-Type':'application/json'}});
  }catch{return Response.json({error:'analysis service unavailable'},{status:503,headers:cors});}
});
