import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract ERC20PresetMinterPauserDecimals is ERC20PresetMinterPauser {

    uint8 private immutable customDecimals;
    constructor(string memory name, string memory symbol, uint8 decimals) ERC20PresetMinterPauser(name, symbol){
        customDecimals = decimals;
    }

    function decimals() public view virtual override(ERC20) returns (uint8) {
        return customDecimals;
    }
}