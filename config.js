
var gateways = {
    rnuF96W4SZoCJmbHYBFoJZpR8eCaxNvekK: 'rippecn',
    rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B:  'bitstamp',
//  rBcYpuDT1aXNo4jnqczWJTytKGdBGufsre: 'weex', // AUD
//  rpvfJ4mR6QQAeogpXEKnuyGBx8mYCSnYZi: 'weex', // BTC
//  r47RkFi1Ew3LvCNKT6ufw3ZCyj5AJiLHi9: 'weex', // CAD
//  r9vbV3EHvXWjSkeQ6CAcYVPGeq7TuiXY2X: 'weex', // USD
};

var hotwallets = {
//  rrpNnNLKrartuEqfJGpqyDwPj1AFPg9vn1: 'bitstamp',
};

var remote_cn_config = {
  'trusted' : true,
  'websocket_ip' : "s1.ripple.com",
  'websocket_port' : 51233,
  'websocket_ssl' : true,
  'local_sequence' : true,
  'local_fee' : true,
};

var remote_config = {
  'trusted' : true,
  'websocket_ip' : "s_west.ripple.com",
  'websocket_port' : 443,
  'websocket_ssl' : true,
  'local_sequence' : true,
  'local_fee' : true,
};

exports.remote_config	= remote_config;
exports.remote_cn_config = remote_cn_config;
exports.gateways	= gateways;
exports.hotwallets = hotwallets;
