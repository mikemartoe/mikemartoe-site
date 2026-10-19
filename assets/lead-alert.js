/* Lead push alerts: when any FormSubmit form on the site is submitted (after the browser's
   own validation passes), fire a non-blocking POST to ntfy.sh so Mike's phone gets a push.
   The normal FormSubmit submission always continues; ntfy errors are ignored.
   Title/priority/tags go in query params so the POST is a simple CORS request (no preflight). */
(function(){
  var TOPIC='mikemartoe-leads-neecosgi';
  var URL='https://ntfy.sh/'+TOPIC;
  var TITLES={
    'showing-request':'Showing Request - 901 Sandtree',
    'showing':'Open House RSVP / Info - 901 Sandtree',
    'seller-valuation':'Seller Lead - Home Value Report (Sandtree page)',
    'buyer-relocation':'Buyer Lead - Relocation (Sandtree page)'
  };
  var LABELS={name:'Name',full_name:'Name',phone:'Phone',email:'Email',preferred_date:'Preferred date',
    preferred_time:'Preferred time',working_with_agent:'Working with an agent',agent_name:'Agent name',
    note:'Note',message:'Message',intent:'Interested in',best_time:'Best time',preferred_contact:'Preferred contact',
    property_address:'Property address',address:'Address',timeline:'Timeline',timeframe:'Timeframe',
    price_range:'Price range',beds:'Beds',baths:'Baths',moving_from:'Moving from',desired_areas:'Desired areas',
    condition:'Condition',listing:'Listing',lead_type:'Lead type',request_type:'Request type',source:'Source'};
  function titleFor(f){
    if(f.id&&TITLES[f.id]&&location.pathname.indexOf('listings')!==-1) return TITLES[f.id];
    var s=f.querySelector('input[name="_subject"]'), v=s?s.value:'';
    var m=v.match(/\(([^)]+)\)/);
    return 'Website Lead - '+(m?m[1]:(v||'mikemartoe.com'));
  }
  function bodyFor(f){
    var lines=[], seen={};
    Array.prototype.forEach.call(f.elements,function(el){
      var n=el.name; if(!n||n.charAt(0)==='_'||n==='consent'||seen[n]) return;
      if(el.type==='checkbox'&&!el.checked) return;
      var v;
      if(el.type==='radio'){ var c=f.querySelector('input[name="'+n+'"]:checked'); v=c?c.value:''; seen[n]=1; }
      else v=el.value;
      v=String(v||'').trim(); if(!v) return;
      lines.push((LABELS[n]||n)+': '+v);
    });
    lines.push('Page: '+location.href.split('#')[0]);
    return lines.join('\n');
  }
  function send(f){
    try{
      var u=URL+'?title='+encodeURIComponent(titleFor(f))+'&priority=high&tags=house';
      var b=bodyFor(f);
      if(window.fetch){ fetch(u,{method:'POST',body:b,keepalive:true,mode:'no-cors'}).catch(function(){}); }
      else if(navigator.sendBeacon){ navigator.sendBeacon(u,b); }
    }catch(e){}
  }
  document.addEventListener('submit',function(e){
    var f=e.target;
    if(!f||!f.action||f.action.indexOf('formsubmit.co')===-1) return;
    var hp=f.querySelector('input[name="_honey"]'); if(hp&&hp.value) return; /* bot trap filled: skip alert */
    if(f.__ntfySent) return; f.__ntfySent=true;
    send(f); /* no preventDefault: FormSubmit submission continues */
  },true);
})();
