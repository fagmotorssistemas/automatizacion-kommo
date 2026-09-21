-- bot_id vive en inventoryoracle (el carro), no en una tabla aparte.
-- img_prefix = como se llama el paquete de fotos en Kommo.
-- Nest dispara inventoryoracle.bot_id cuando ya tiene el id del carro.

alter table public.inventoryoracle
  add column if not exists bot_id integer;

comment on column public.inventoryoracle.img_prefix is
  'Nombre del paquete de fotos en Kommo (apodo). No se usa para disparar el bot.';

comment on column public.inventoryoracle.bot_id is
  'Salesbot de fotos de Kommo. Nest dispara este id cuando ya identificó el carro.';

update public.inventoryoracle as car
set bot_id = map.bot_id
from (
  values
    ('captiva_2022', 195329),
    ('changan_cs35_2020', 195327),
    ('changan_cs35_2023', 177193),
    ('chery_qq_2012', 173821),
    ('chery_tiggo_2_pro_2026', 192775),
    ('chevrolet_dmax_2021', 194719),
    ('chevrolet_dmax_4x4_blanco', 187125),
    ('chevrolet_optra_2012', 188889),
    ('chevrolet_plateado_2023', 195567),
    ('chevrolet_vino_2022', 195721),
    ('dmax_cabina_sencilla_2020', 195565),
    ('dongfeng_2022', 195331),
    ('faw_betsune_2024', 166548),
    ('fiat_500_2017', 195571),
    ('ford_ecosport_2020', 166291),
    ('ford_escape_2023', 179985),
    ('ford_explorer_2018', 193365),
    ('ford_f150_2014', 193363),
    ('ford_lariat_2018', 195573),
    ('ford_ranger_plomo_2024', 183959),
    ('fortuner_2015', 194739),
    ('fortuner_2021', 195059),
    ('foton_tunland_2023', 192769),
    ('great_wingle_2021', 182661),
    ('haval_2019', 194721),
    ('hilux_2022', 193915),
    ('hyundai_creta_2022', 195575),
    ('hyundai_kona_2022', 179995),
    ('hyundai_sonata_2016', 166307),
    ('jetour_ii_2023', 195631),
    ('jetour_plus_2025', 193917),
    ('jetour_t1_2026', 195579),
    ('kia_picanto_2023', 187211),
    ('kia_seltos_2020', 193369),
    ('kia_sportage_2023', 175909),
    ('kia_sportage_2024', 195335),
    ('kia_sportage_plata_2019', 175907),
    ('kia_sportage_r_2019', 166536),
    ('kia_sportage_rojo_2019', 195725),
    ('kia_sportage_rojo_2020', 180771),
    ('kia_sportage_sl_2019', 195333),
    ('kona_2024', 194725),
    ('land_crusier_2016', 190477),
    ('mercedez_benz_2024', 195723),
    ('mini_couper_2012', 194741),
    ('mitsubishi_montero_2022', 183957),
    ('nissan_frontier_2021', 195583),
    ('nissan_kicks_2020', 180321),
    ('nissan_setra_2014', 184241),
    ('nissan_xtrail_2016', 195581),
    ('peugeot_2008_2022', 192781),
    ('peugeot_2022', 166538),
    ('ram_700_2023', 190489),
    ('renault_kwid_2026', 193333),
    ('susuki_blanco_2015', 174885),
    ('toyota_fortuner_2022', 190485),
    ('toyota_hilux_2025', 187403),
    ('toyota_newrav4_2015', 181821),
    ('toyota_rav4_2013', 193143),
    ('toyota_rav4_2020', 194731),
    ('toyota_runner_2004', 195339),
    ('toyota_rush_2020', 193141),
    ('tracker_2019', 194169),
    ('tucson_2020', 194723),
    ('volkswagen_golf_2005', 181565),
    ('volkswagen_polo_2024', 195341),
    ('zx_terralord_2023', 183979)
) as map(img_prefix, bot_id)
where car.img_prefix = map.img_prefix;

drop table if exists public.vehicle_salesbots;
