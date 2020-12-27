
class Player {
  constructor(fenceCount) {
    this.remainFenceCount = fenceCount;
    this.pawn = new Piece();
    this.fences = [];
    for (let i = 0; i < fenceCount; i++) {
      this.fences.push(new Piece());
    }
  }
}
