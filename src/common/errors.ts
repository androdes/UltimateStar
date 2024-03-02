export class NoEnoughRepairKits extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoEnoughRepairKits";
  }
}
