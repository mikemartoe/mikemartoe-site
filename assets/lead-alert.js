/* Lead push alerts: when any FormSubmit form on the site is submitted (after the browser's
   own validation passes), fire a non-blocking publish to Mike's ntfy server (ntfy-me.com,
   the server his iPhone app is subscribed on) so his phone gets a push.
   The normal FormSubmit submission always continues; ntfy errors are ignored.
   Uses ntfy JSON publishing (POST to the server root, JSON in a text/plain body) so it stays a
   simple CORS request (no preflight) and can carry action buttons:
   - Showing Request alerts: "Approve and Book" + "Call".
     "Approve and Book" opens a prefilled Google Calendar event (no bot or routine needed):
     title "Showing: 901 Sandtree - <name>", the requested date at the start of the requested
     window (30 min, America/New_York), the listing address as location, the lead details, and the
     requester's email pre-added as a guest. Mike taps Save, and Google offers to email the invite,
     which books and confirms the showing in one step.
   - Other leads with a phone number: "Call". */
(function(){
  var TOPIC='mikemartoe-leads-neecosgi';
  var SERVER='https://ntfy-me.com/';
  var LISTING_ADDR='901 Sandtree Drive, Palm Beach Gardens, FL 33403';
  /* start hour of each time window; Flexible defaults to 10 AM */
  var WINDOW_START={'Morning':9,'Midday':12,'Afternoon':15,'Evening':18,'Flexible':10};
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
  function val(f,n){
    var el=f.querySelector('[name="'+n+'"]:checked')||f.querySelector('[name="'+n+'"]');
    if(!el||((el.type==='radio'||el.type==='checkbox')&&!el.checked)) return '';
    return String(el.value||'').replace(/\s+/g,' ').trim();
  }
  function telFor(p){
    var d=String(p||'').replace(/\D/g,'');
    if(d.length===10) return 'tel:+1'+d;
    if(d.length===11&&d.charAt(0)==='1') return 'tel:+'+d;
    return d.length>=7?'tel:'+d:'';
  }
  function pad(n){ return (n<10?'0':'')+n; }
  function approveDates(f){
    var d=val(f,'preferred_date').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!d) return '';
    var w=val(f,'preferred_time').split(' ')[0], h=WINDOW_START.hasOwnProperty(w)?WINDOW_START[w]:10;
    var day=d[1]+d[2]+d[3];
    return day+'T'+pad(h)+'0000/'+day+'T'+pad(h)+'3000';
  }
  function approveDetails(f){
    return ['Showing request from mikemartoe.com (approved).','',
      'Name: '+val(f,'name'),'Phone: '+val(f,'phone'),'Email: '+val(f,'email'),
      'Requested: '+val(f,'preferred_date')+' '+val(f,'preferred_time'),
      'Working with an agent: '+val(f,'working_with_agent')+(val(f,'agent_name')?' ('+val(f,'agent_name')+')':''),
      'Note: '+val(f,'note'),'',
      'Listing: '+LISTING_ADDR+' (MLS B26089813)'].join('\n');
  }
  function approveUrl(f){
    var q=['action=TEMPLATE',
      'text='+encodeURIComponent('Showing: 901 Sandtree - '+(val(f,'name')||'Buyer')),
      'details='+encodeURIComponent(approveDetails(f)),
      'location='+encodeURIComponent(LISTING_ADDR),
      'ctz=America/New_York'];
    var dt=approveDates(f); if(dt) q.push('dates='+dt);
    var em=val(f,'email'); if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) q.push('add='+encodeURIComponent(em));
    return 'https://calendar.google.com/calendar/render?'+q.join('&');
  }
  function actionsFor(f){
    var a=[], isShowing=f.id==='showing-request'&&location.pathname.indexOf('listings')!==-1;
    if(isShowing){
      a.push({action:'view',label:'Approve and Book',clear:true,url:approveUrl(f)});
    }
    var t=telFor(val(f,'phone'));
    if(t) a.push({action:'view',label:'Call',url:t});
    return a;
  }
  function send(f){
    try{
      var msg={topic:TOPIC,title:titleFor(f),message:bodyFor(f),priority:4,tags:['house']};
      try{ var a=actionsFor(f); if(a.length) msg.actions=a; }catch(e){}
      var b=JSON.stringify(msg);
      if(window.fetch){ fetch(SERVER,{method:'POST',body:b,keepalive:true,mode:'no-cors'}).catch(function(){}); }
      else if(navigator.sendBeacon){ navigator.sendBeacon(SERVER,b); }
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
