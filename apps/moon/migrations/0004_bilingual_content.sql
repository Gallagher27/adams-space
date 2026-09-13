ALTER TABLE timeline_items ADD COLUMN title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE timeline_items ADD COLUMN note_en TEXT NOT NULL DEFAULT '';
ALTER TABLE blessings ADD COLUMN name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE blessings ADD COLUMN message_en TEXT NOT NULL DEFAULT '';

UPDATE timeline_items SET title_en = 'The beginning of time', note_en = 'Shimuen came into the world.' WHERE id = 'birth';
UPDATE timeline_items SET title_en = 'Our first hello', note_en = 'A tiny portrait from his first day.' WHERE id = 'first-meeting';
UPDATE timeline_items SET title_en = 'A dream on day six', note_en = 'A quiet day of deep sleep.' WHERE id = 'day-six-dream';
UPDATE timeline_items SET title_en = 'Morning light on day eight', note_en = 'Sunlight rested on his tiny hands and cheeks.' WHERE id = 'day-eight-light';
UPDATE timeline_items SET title_en = 'Watermelon Taro is here' WHERE id = '894314da-0f2c-4ebd-ac85-9dda0ac77efa';

UPDATE blessings SET name_en = 'Da Die', message_en = '' WHERE id = 'bb5af605-522a-4b23-8a4b-af2e72c5ad07';
UPDATE blessings SET name_en = 'Mom', message_en = 'May you grow healthy, happy, round-cheeked, and wonderfully cute.' WHERE id = '468c1b8a-fe2f-42e8-b21d-ee769b600b5c';
UPDATE blessings SET name_en = 'Grandma', message_en = 'May you grow healthy and happy, surrounded by grace and wisdom.' WHERE id = 'bc665d89-1318-4d62-9ca0-a79b16dd661d';
UPDATE blessings SET name_en = 'Auntie', message_en = 'May our little moon always sleep peacefully~' WHERE id = 'c166c5e3-c35b-4c86-924a-7fd94d8b5c26';
