use std::io::Cursor;
use wasm_bindgen::prelude::*;
use rbx_binary::{from_reader, to_writer};
use rbx_dom_weak::types::Ref;

#[wasm_bindgen]
pub fn merge_place(place_bytes: &[u8], model_bytes: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut place = from_reader(Cursor::new(place_bytes))
        .map_err(|error| JsValue::from_str(&format!("Nuk u lexua loja baze: {error}")))?;
    let model = from_reader(Cursor::new(model_bytes))
        .map_err(|error| JsValue::from_str(&format!("Nuk u lexua modeli: {error}")))?;

    let workspace_ref = place
        .descendants()
        .find(|instance| instance.class.as_str() == "Workspace")
        .map(|instance| instance.referent())
        .ok_or_else(|| JsValue::from_str("Loja baze nuk permban Workspace."))?;

    let model_roots: Vec<Ref> = model.root().children().to_vec();
    if model_roots.is_empty() {
        return Err(JsValue::from_str("Modeli .rbxm eshte bosh."));
    }

    let inserted = model.clone_multiple_into_external(&model_roots, &mut place);
    for referent in inserted {
        place.transfer_within(referent, workspace_ref);
    }

    let mut output = Vec::new();
    to_writer(&mut output, &place, &[place.root_ref()])
        .map_err(|error| JsValue::from_str(&format!("Nuk u krijua file-i i ri: {error}")))?;

    Ok(output)
}
