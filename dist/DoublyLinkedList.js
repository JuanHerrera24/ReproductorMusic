"use strict";
/**
 * ============================================================
 *  DOUBLY LINKED LIST (generic)
 * ============================================================
 *  Every node knows its previous (prev) and next (next) node,
 *  so the list can be traversed in both directions.
 *
 *    NULL ⇄ [A] ⇄ [B] ⇄ [C] ⇄ NULL
 *           head         tail
 *
 *  Complexity:
 *    addFirst / addLast ........ O(1)
 *    addAt(index) .............. O(n)  (walks from the closest end)
 *    removeNode(node) .......... O(1)  (the node reference is already known)
 *    removeAt(index) ........... O(n)
 *    node.next / node.prev ..... O(1)  (skip forward / go back)
 */
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
    /** Inserts at the START of the list. O(1) */
    addFirst(value) {
        const node = new DoublyNode(value);
        this.linkAt(node, 0);
        return node;
    }
    /** Inserts at the END of the list. O(1) */
    addLast(value) {
        const node = new DoublyNode(value);
        this.linkAt(node, this._size);
        return node;
    }
    /** Inserts at ANY POSITION (0 ≤ index ≤ size). O(n) */
    addAt(index, value) {
        if (!Number.isInteger(index) || index < 0 || index > this._size) {
            throw new RangeError(`Índice fuera de rango: ${index} (tamaño ${this._size})`);
        }
        const node = new DoublyNode(value);
        this.linkAt(node, index);
        return node;
    }
    /** Removes a specific node. O(1) */
    removeNode(node) {
        this.unlink(node);
        return node.value;
    }
    /** Removes the node at the given position. O(n) */
    removeAt(index) {
        const node = this.getNodeAt(index);
        if (!node)
            throw new RangeError(`Índice fuera de rango: ${index}`);
        return this.removeNode(node);
    }
    /** Moves a node to another position keeping its identity. */
    move(node, newIndex) {
        if (newIndex < 0 || newIndex >= this._size) {
            throw new RangeError(`Índice fuera de rango: ${newIndex}`);
        }
        this.unlink(node);
        this.linkAt(node, newIndex);
    }
    /** Gets the node at a position, walking from the closest end. */
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
    /** Returns the position of a node (or -1 if absent). O(n) */
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
    /** Iterates over the nodes from head to tail. */
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
    // ---------------------------------------------------------
    //  Internal primitives: all the pointer logic lives here
    // ---------------------------------------------------------
    /** Links `node` so that it ends up at position `index`. */
    linkAt(node, index) {
        if (index === 0) {
            // Start (also covers an empty list)
            node.prev = null;
            node.next = this.head;
            if (this.head)
                this.head.prev = node;
            else
                this.tail = node;
            this.head = node;
        }
        else if (index === this._size) {
            // End
            node.next = null;
            node.prev = this.tail;
            if (this.tail)
                this.tail.next = node;
            else
                this.head = node;
            this.tail = node;
        }
        else {
            // Middle: inserted BEFORE the node that currently holds `index`
            const ref = this.getNodeAt(index);
            node.prev = ref.prev;
            node.next = ref;
            ref.prev.next = node;
            ref.prev = node;
        }
        this._size++;
    }
    /** Unlinks `node` from the list, repairing the neighbouring pointers. */
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
