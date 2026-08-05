INSERT OR IGNORE INTO app_configs (id,key,value,type) VALUES
  ('cfg-bank','demo_payment.bank_qr_label','LP • BANK QR','text'),
  ('cfg-wallet','demo_payment.binance_address','0x84aB...dE20','text'),
  ('cfg-enabled','demo_payment.enabled','true','boolean');
INSERT OR IGNORE INTO game_rooms (id,game_type,name,status,min_bet,max_bet)
VALUES ('demo-room','arcade','Lumen Arcade Demo','active',1000,500000);
