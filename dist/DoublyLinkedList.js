"use strict";
class DoublyNode {
    constructor(value) {
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}
class DoublyLinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this._size = 0;
    }
    get size() {
        return this._size;
    }
    isEmpty() {
        return this._size === 0;
    }
    addFirst(value) {
        const node = new DoublyNode(value);
        this.linkAt(node, 0);
        return node;
    }
    addLast(value) {
        const node = new DoublyNode(value);
        this.linkAt(node, this._size);
        return node;
    }
    addAt(index, value) {
        if (!Number.isInteger(index) || index < 0 || index > this._size) {
            throw new RangeError(`Índice fuera de rango: ${index} (tamaño ${this._size})`);
        }
        const node = new DoublyNode(value);
        this.linkAt(node, index);
        return node;
    }
    removeNode(node) {
        this.unlink(node);
        return node.value;
    }
    removeAt(index) {
        const node = this.getNodeAt(index);
        if (!node)
            throw new RangeError(`Índice fuera de rango: ${index}`);
        return this.removeNode(node);
    }
    move(node, newIndex) {
        if (newIndex < 0 || newIndex >= this._size) {
            throw new RangeError(`Índice fuera de rango: ${newIndex}`);
        }
        this.unlink(node);
        this.linkAt(node, newIndex);
    }
    getNodeAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this._size)
            return null;
        if (index <= this._size / 2) {
            let current = this.head;
            for (let i = 0; i < index; i++)
                current = current.next;
            return current;
        }
        let current = this.tail;
        for (let i = this._size - 1; i > index; i--)
            current = current.prev;
        return current;
    }
    indexOf(node) {
        let i = 0;
        for (const n of this.nodes()) {
            if (n === node)
                return i;
            i++;
        }
        return -1;
    }
    clear() {
        this.head = null;
        this.tail = null;
        this._size = 0;
    }
    *nodes() {
        let current = this.head;
        while (current) {
            yield current;
            current = current.next;
        }
    }
    toArray() {
        return Array.from(this.nodes(), (n) => n.value);
    }
    linkAt(node, index) {
        if (index === 0) {
            node.prev = null;
            node.next = this.head;
            if (this.head)
                this.head.prev = node;
            else
                this.tail = node;
            this.head = node;
        }
        else if (index === this._size) {
            node.next = null;
            node.prev = this.tail;
            if (this.tail)
                this.tail.next = node;
            else
                this.head = node;
            this.tail = node;
        }
        else {
            const ref = this.getNodeAt(index);
            node.prev = ref.prev;
            node.next = ref;
            ref.prev.next = node;
            ref.prev = node;
        }
        this._size++;
    }
    unlink(node) {
        if (node.prev)
            node.prev.next = node.next;
        else
            this.head = node.next;
        if (node.next)
            node.next.prev = node.prev;
        else
            this.tail = node.prev;
        node.prev = null;
        node.next = null;
        this._size--;
    }
}
