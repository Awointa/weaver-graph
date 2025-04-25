use cainome::rs::Abigen;
use std::collections::HashMap;

fn main() {
    // Aliases added from the ABI
    let mut aliases = HashMap::new();

    let weaver_abigen =
        Abigen::new("weaver", "./abi/weaver_contract.abi.json").with_types_aliases(aliases).with_derives(vec!["serde::Serialize".to_string(), "serde::Deserialize".to_string()]);

        weaver_abigen
            .generate()
            .expect("Fail to generate bindings")
            .write_to_file("./src/abi/weaver_contract.rs")
            .unwrap();
    // Aliases added from the ABI
    let mut aliases = HashMap::new();
    aliases.insert(
        String::from("weaver_contract::mods::protocol::protocolcomponent::ProtocolCampaign::Event"),
        String::from("ProtocolCampaignEvent"),
    );
    aliases.insert(
        String::from("openzeppelin_access::ownable::ownable::OwnableComponent::Event"),
        String::from("OwnableComponentEvent"),
    );

    let protocols_abigen =
        Abigen::new("protocols", "./abi/protocols_contract.abi.json").with_types_aliases(aliases).with_derives(vec!["serde::Serialize".to_string(), "serde::Deserialize".to_string()]);

        protocols_abigen
            .generate()
            .expect("Fail to generate bindings")
            .write_to_file("./src/abi/protocols_contract.rs")
            .unwrap();
}