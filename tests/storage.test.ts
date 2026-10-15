import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  saveDocument,
  getAllDocuments,
  getDocument,
  deleteDocument,
  searchDocuments,
  clearAllDocuments,
} from '../src/services/storage/idbStorage';
import type { DocumentItem } from '../src/types';

describe('Document Storage Service (IndexedDB)', () => {
  beforeEach(async () => {
    await clearAllDocuments();
  });

  it('saves and retrieves documents in correct order (newest first)', async () => {
    const doc1: DocumentItem = {
      id: 'doc-1',
      title: 'تقرير الأول',
      content: 'محتوى تجريبي 1',
      type: 'text',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const doc2: DocumentItem = {
      id: 'doc-2',
      title: 'تقرير الثاني',
      content: 'محتوى تجريبي 2',
      type: 'word',
      createdAt: 2000,
      updatedAt: 2000,
    };

    await saveDocument(doc1);
    await saveDocument(doc2);

    const all = await getAllDocuments();
    expect(all.length).toBe(2);
    // doc2 was saved with newer updatedAt, so it should be first
    expect(all[0].id).toBe('doc-2');
    expect(all[1].id).toBe('doc-1');
  });

  it('retrieves an individual document by id', async () => {
    const doc: DocumentItem = {
      id: 'doc-test-id',
      title: 'مستند مفرد',
      content: 'محتوى خاص',
      type: 'excel',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveDocument(doc);
    const retrieved = await getDocument('doc-test-id');
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('مستند مفرد');
    expect(retrieved?.type).toBe('excel');
  });

  it('filters documents correctly using search query', async () => {
    const docA: DocumentItem = {
      id: 'doc-a',
      title: 'فاتورة مبيعات الأجهزة',
      content: 'أجهزة حاسوب وطابعات',
      type: 'excel',
      createdAt: 100,
      updatedAt: 100,
    };

    const docB: DocumentItem = {
      id: 'doc-b',
      title: 'خطاب رسمي للشركة',
      content: 'بخصوص التعاقد السنوي',
      type: 'word',
      createdAt: 200,
      updatedAt: 200,
    };

    await saveDocument(docA);
    await saveDocument(docB);

    const resultsSales = await searchDocuments('فاتورة');
    expect(resultsSales.length).toBe(1);
    expect(resultsSales[0].id).toBe('doc-a');

    const resultsContract = await searchDocuments('التعاقد');
    expect(resultsContract.length).toBe(1);
    expect(resultsContract[0].id).toBe('doc-b');

    const resultsAll = await searchDocuments('');
    expect(resultsAll.length).toBe(2);
  });

  it('deletes documents and clears store on demand', async () => {
    const doc: DocumentItem = {
      id: 'doc-delete-me',
      title: 'حذف',
      content: '',
      type: 'text',
      createdAt: 10,
      updatedAt: 10,
    };

    await saveDocument(doc);
    expect((await getAllDocuments()).length).toBe(1);

    await deleteDocument('doc-delete-me');
    expect((await getAllDocuments()).length).toBe(0);
  });
});
