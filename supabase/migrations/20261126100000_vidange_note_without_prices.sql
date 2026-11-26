-- Vidange charges: the detail lists the items only, the total is in Montant.
-- Removes " 600 MAD"-style prices left after each item by the first merge.
update public.charges
   set note = regexp_replace(note, ' [0-9][0-9  ]*(,[0-9]+)? MAD(?=,|$)', '', 'g')
 where category = 'vidange'
   and note ~ '^Vidange à [0-9  ]+ km · '
   and note ~ ' MAD(,|$)';
