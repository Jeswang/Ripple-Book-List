#!/usr/bin/node

var Amount        = require("ripple-lib").Amount;
var Currency      = require("ripple-lib").Currency;
var Remote        = require("ripple-lib").Remote;
var Transaction   = require("ripple-lib").Transaction;
var UInt160       = require("ripple-lib").UInt160;
var extend        = require("extend");
var blessed       = require('blessed');
var gateways      = require("./config").gateways;
var hotwallets    = require("./config").hotwallets;
var remote_config = require("./config").remote_cn_config;

var gateway_addresses = extend(extend({}, gateways), hotwallets);
var opts_gateways = {
  'gateways' : gateway_addresses
};



var self  = this;

remote  = Remote.from_config(remote_config);

var process_offers  = function (m) {
  if (m.meta.TransactionResult === 'tesSUCCESS')
  {
    var taker   = m.transaction.Account;
    var trades  = [];
    var buying  = false;

    m.meta.AffectedNodes.forEach(function (n) {
        var type;
        
        if ('ModifiedNode' in n)
          type  = 'ModifiedNode';
        else if ('DeletedNode' in n)
          type  = 'DeletedNode';

        var base  = type ? n[type] : undefined;
        
        if (base                                  // A relevant type.
          && base.LedgerEntryType === 'Offer'
          && base.PreviousFields                  // Not an unfunded delete.
          && 'TakerGets' in base.PreviousFields     // Not a microscopic offer
          && 'TakerPays' in base.PreviousFields) {  // Not a microscopic offer
          var pf              = base.PreviousFields;
          var ff              = base.FinalFields;
          var offer_owner     = ff.Account;
          var offer_sequence  = ff.Sequence;
          var taker_got       = Amount.from_json(pf.TakerGets).subtract(Amount.from_json(ff.TakerGets));
          var taker_paid      = Amount.from_json(pf.TakerPays).subtract(Amount.from_json(ff.TakerPays));
          var book_price      = Amount.from_quality(ff.BookDirectory, "1", "1");

          if (taker_got.is_native())
          {
            buying      = true;
            book_price  = book_price.multiply(Amount.from_json("1000000")); // Adjust for drops: The result would be a million times too small.
            book_price  = Amount.from_json("1.0/1/1").divide(book_price);

            var tg  = taker_got;
            var tp  = taker_paid;

            taker_got   = tp;
            taker_paid  = tg;
          }
          else
          {
            book_price  = book_price.divide(Amount.from_json("1000000")); // Adjust for drops: The result would be a million times too large.
          }

          if (taker_paid.is_native())
          {

            var gateway = gateways[taker_got.issuer().to_json()];

            if (gateway)
            {
              var n = {
                  gateway:        gateway,
                  taker_paid:     taker_paid,
                  book_price:     book_price,
                  taker_got:      taker_got,
                  offer_owner:    offer_owner,
                  offer_sequence: offer_sequence,
                  sort:           Number(book_price.to_human({
                                      precision: 8,
                                      group_sep: false,
                                    })),
                };
              trades.push(n);
            }
            else
            {
              // Ignore unrenowned issuer.
            }
          }
          else
          {
            // Ignore IOU for IOU.
          }
        }
      });

    trades.sort(buying
        ? function (a,b) { return b.sort-a.sort; }  // Normal order: lowest first
        : function (a,b) { return a.sort-b.sort; }  // Reverse.
      );


    trades.forEach(function (t) {
      //买入

      if(t.taker_paid)
        output("成交: " + t.taker_paid.to_human_full() + " @ " + Amount.from_json("1.0/1/1").divide(t.book_price).to_human() + " " +  t.taker_got.to_human_full());
    });
  }
}

var output  = function(line){
  bottom_box.insertBottom(line);
  bottom_box.scroll(1);
  screen.render();
};

var process_tx  = function (m) {

  if (m.transaction.TransactionType === 'Payment')
  {
    process_offers(m);
  }
  else if (m.transaction.TransactionType === 'OfferCreate')
  {
    // console.log("OfferCreate: ", JSON.stringify(m, undefined, 2));

    var owner       = UInt160.json_rewrite(m.transaction.Account, opts_gateways);
    var taker_gets  = Amount.from_json(m.transaction.TakerGets);
    var taker_pays  = Amount.from_json(m.transaction.TakerPays);
    var b_fok       = !!(m.transaction.Flags & Transaction.flags.OfferCreate.FillOrKill);
    var b_ioc       = !!(m.transaction.Flags & Transaction.flags.OfferCreate.ImmediateOrCancel);

    say_type  = b_fok ? '立刻全单' : b_ioc ? '即时购买' : '正常挂单';
    say_watch = UInt160.json_rewrite(m.transaction.Account, opts_gateways)
          + " #" + m.transaction.Sequence
          + " offers " + taker_gets.to_human_full(opts_gateways)
          + " for " + taker_pays.to_human_full(opts_gateways);

    if (m.meta.TransactionResult === 'tesSUCCESS'
      && (taker_gets.is_native() || taker_pays.is_native()))
    {
      process_offers(m);

      // Show portion off offer that stuck.
      var what    = taker_gets.is_native()
                      ? '新卖单'
                      : '新买单';

      var created_nodes  = m.meta
                      && m.meta.AffectedNodes.filter(function (node) {
                          return node.CreatedNode && node.CreatedNode.LedgerEntryType === 'Offer';
                        });

      if (created_nodes.length) {
        var created_node  = created_nodes[0];

        //console.log("transaction: ", JSON.stringify(m.meta.AffectedNodes, undefined, 2));
        //console.log("filtered: ", JSON.stringify(m.meta.AffectedNodes, undefined, 2));
        //console.log("CREATED: ", JSON.stringify(created_node, undefined, 2));
        var created_taker_gets = Amount.from_json(created_node.CreatedNode.NewFields.TakerGets);
        var created_taker_pays = Amount.from_json(created_node.CreatedNode.NewFields.TakerPays);

        var xrp     = taker_gets.is_native()
                        ? created_taker_gets
                        : created_taker_pays;
        var amount  = taker_gets.is_native()
                        ? created_taker_pays
                        : created_taker_gets;

        var gateway = gateways[amount.issuer().to_json()];

        if (gateway == 'rippecn')
        {
          var line =
                what
                  + " " + gateway
                  + " " + xrp.to_human()
                  + " @ " + (amount.ratio_human(xrp).to_human())
                  + " 总计 " + amount.to_human() + " " + amount.currency().to_human();
          output(line);          
        }
      }
    }
  }
};

remote.connect(function() {})
.once('ledger_closed', function (m) {
  self.rippled  = true;

  bottom_box.setContent("*** Connected to rippled");
  if (process.argv.length > 2)
  {
    remote
    .request_tx(process.argv[2])
    .on('success', function (m) {
                remote.emit('transaction_all', {
                  transaction: m,
                  meta: m.meta,
                });

                process.exit();
              })
    .request();
  }
})
.on('transaction_all', process_tx);



var buyer_book = remote.book('CNY', 'rnuF96W4SZoCJmbHYBFoJZpR8eCaxNvekK', 'XRP', '');

var seller_book = remote.book('XRP', '', 'CNY', 'rnuF96W4SZoCJmbHYBFoJZpR8eCaxNvekK');


var screen = blessed.screen();

var left_box = blessed.box({
  left: '0',
  top: '0',
  width: '49%',
  height: '80%',
  content: 'Loading...',
});

screen.append(left_box);

var right_box = blessed.box({
  right: '0',
  top: '0',
  width: '49%',
  height: '80%',
  content: 'Loading...',
});

screen.append(right_box);

var bottom_box = blessed.ScrollableBox({
  bottom: '0',
  left: '0',
  width: '100%',
  height: '20%',
  content: 'Loading...',
  scrollable: true,
});

screen.append(bottom_box);

screen.render();

buyer_book.on("model", function(offers){
  var contents = "单价      XRP 数量    CNY 总价\n";

  for(var i = 0; i < offers.length;i++){
   var one_line = parseFloat((offers[i].TakerGets.value / (offers[i].TakerPays/1000000)).toString()).toFixed(4).toString() + "\t" + (offers[i].TakerPays/1000000).toFixed(5).toString().substring(0, 8) + "\t" + parseFloat(offers[i].TakerGets.value).toFixed(2) + " " + '\n';
   contents = contents + one_line;
 }	
 left_box.setContent(contents);
 screen.render();
});

seller_book.on("model", function(offers){
  //console.log(offers[0].TakerPays.value + " " + offers[0].TakerGets + " " + offers[0].TakerPays /offers[0].TakerGets.value /1000000);
  var right_contents = "单价      XRP 数量    CNY 总价\n";

  for(var i = 0; i < offers.length; i++){
    var one_line = parseFloat((offers[i].TakerPays.value / (offers[i].TakerGets/1000000)).toString()).toFixed(4).toString() + "\t" + (offers[i].TakerGets/1000000).toFixed(5).toString().substring(0, 8) + "\t" + parseFloat(offers[i].TakerPays.value).toFixed(2) + " " + '\n';
    right_contents = right_contents + one_line;
  } 
  right_box.setContent(right_contents);
  screen.render();
});


