INSERT OR IGNORE INTO app_configs (id,key,value,type) VALUES
  ('cfg-bank-name','payment.bank_name','Vietcombank','text'),
  ('cfg-bank-acc','payment.bank_account','1029384756','text'),
  ('cfg-bank-holder','payment.bank_holder','HIT CLUB DEPOSIT','text'),
  ('cfg-bank-qr','payment.bank_qr_url','','text'),
  ('cfg-trc20-qr','payment.binance_qr_url','','text'),
  ('cfg-trc20','payment.binance_trc20','TYourTRC20WalletAddressHere','text'),
  ('cfg-min-dep','payment.min_deposit','100000','text'),
  ('cfg-min-wd','payment.min_withdraw','200000','text'),
  ('cfg-enabled','payment.enabled','true','boolean');
INSERT OR IGNORE INTO game_rooms (id,game_type,name,status,min_bet,max_bet)
VALUES ('demo-room','arcade','HIT CLUB Arcade','active',1000,500000);
