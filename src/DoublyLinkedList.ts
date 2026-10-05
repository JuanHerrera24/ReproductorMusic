class DoublyNode<T> {
  prev: DoublyNode<T> | null = null;
  next: DoublyNode<T> | null = null;

  constructor(public value: T) {}
}

class DoublyLinkedList<T> {
  head: DoublyNode<T> | null = null;
  tail: DoublyNode<T> | null = null;
  private _size = 0;

  get size(): number {
    return this._size;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }

  addFirst(value: T): DoublyNode<T> {
    const node = new DoublyNode(value);
    this.linkAt(node, 0);
    return node;
  }

  addLast(value: T): DoublyNode<T> {
    const node = new DoublyNode(value);
    this.linkAt(node, this._size);
    return node;
  }

  addAt(index: number, value: T): DoublyNode<T> {
    if (!Number.isInteger(index) || index < 0 || index > this._size) {
      throw new RangeError(`Índice fuera de rango: ${index} (tamaño ${this._size})`);
    }
    const node = new DoublyNode(value);
    this.linkAt(node, index);
    return node;
  }

  removeNode(node: DoublyNode<T>): T {
    this.unlink(node);
    return node.value;
  }

  removeAt(index: number): T {
    const node = this.getNodeAt(index);
    if (!node) throw new RangeError(`Índice fuera de rango: ${index}`);
    return this.removeNode(node);
  }

  move(node: DoublyNode<T>, newIndex: number): void {
    if (newIndex < 0 || newIndex >= this._size) {
      throw new RangeError(`Índice fuera de rango: ${newIndex}`);
    }
    this.unlink(node);
    this.linkAt(node, newIndex);
  }

  getNodeAt(index: number): DoublyNode<T> | null {
    if (!Number.isInteger(index) || index < 0 || index >= this._size) return null;

    if (index <= this._size / 2) {
      let current = this.head;
      for (let i = 0; i < index; i++) current = current!.next;
      return current;
    }
    let current = this.tail;
    for (let i = this._size - 1; i > index; i--) current = current!.prev;
    return current;
  }

  indexOf(node: DoublyNode<T>): number {
    let i = 0;
    for (const n of this.nodes()) {
      if (n === node) return i;
      i++;
    }
    return -1;
  }

  clear(): void {
    this.head = null;
    this.tail = null;
    this._size = 0;
  }

  *nodes(): IterableIterator<DoublyNode<T>> {
    let current = this.head;
    while (current) {
      yield current;
      current = current.next;
    }
  }

  toArray(): T[] {
    return Array.from(this.nodes(), (n) => n.value);
  }

  private linkAt(node: DoublyNode<T>, index: number): void {
    if (index === 0) {

      node.prev = null;
      node.next = this.head;
      if (this.head) this.head.prev = node;
      else this.tail = node;
      this.head = node;
    } else if (index === this._size) {

      node.next = null;
      node.prev = this.tail;
      if (this.tail) this.tail.next = node;
      else this.head = node;
      this.tail = node;
    } else {

      const ref = this.getNodeAt(index)!;
      node.prev = ref.prev;
      node.next = ref;
      ref.prev!.next = node;
      ref.prev = node;
    }
    this._size++;
  }

  private unlink(node: DoublyNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    node.prev = null;
    node.next = null;
    this._size--;
  }
}
