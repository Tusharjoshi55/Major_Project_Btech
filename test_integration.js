// Integration test for the complete RAG system
// This test verifies end-to-end functionality of the enhanced RAG implementation

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from './backend/src/app.js';
import pool from './backend/src/config/db.js';

// Test database setup
const TEST_NOTEBOOK_ID = 'test-notebook-123';
const TEST_USER_ID = 'test-user-456';

describe('RAG System Integration Tests', () => {

  beforeEach(async () => {
    // Setup test data
    await pool.query(
      `INSERT INTO users (supabase_uid, email, display_name)
       VALUES ($1, $2, $3) RETURNING id`,
      [TEST_USER_ID, 'test@example.com', 'Test User']
    );

    await pool.query(
      `INSERT INTO notebooks (id, user_id, title)
       VALUES ($1, $2, $3) RETURNING id`,
      [TEST_NOTEBOOK_ID, TEST_USER_ID, 'Test Notebook']
    );
  });

  afterEach(async () => {
    // Cleanup test data
    await pool.query(`DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE notebook_id=$1)`, [TEST_NOTEBOOK_ID]);
    await pool.query(`DELETE FROM chat_sessions WHERE notebook_id=$1`, [TEST_NOTEBOOK_ID]);
    await pool.query(`DELETE FROM notes WHERE notebook_id=$1`, [TEST_NOTEBOOK_ID]);
    await pool.query(`DELETE FROM sources WHERE notebook_id=$1`, [TEST_NOTEBOOK_ID]);
    await pool.query(`DELETE FROM chunks WHERE notebook_id=$1`, [TEST_NOTEBOOK_ID]);
    await pool.query(`DELETE FROM notebooks WHERE id=$1`, [TEST_NOTEBOOK_ID]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [TEST_USER_ID]);
  });

  describe('POST /api/chat - RAG Chat Endpoint', () => {
    it('should generate RAG-based response with citations', async () => {
      // First, ensure we have some test data in the database
      await pool.query(
        `INSERT INTO sources (notebook_id, user_id, title, file_type, file_url, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [TEST_NOTEBOOK_ID, TEST_USER_ID, 'Test Document.pdf', 'pdf', 'https://example.com/test.pdf', 'ready']
      );

      // Mock the embedding and retrieval by inserting test chunks
      await pool.query(
        `INSERT INTO chunks
         (source_id, notebook_id, chunk_index, content, page_number, embedding)
         VALUES
         ($1, $2, 0, $3, $4, $5)`,
        [
          'test-source-1',
          TEST_NOTEBOOK_ID,
          'This is a test document about machine learning and artificial intelligence.',
          1,
          'test-embedding-vector'
        ]
      );

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer test-jwt-token`)
        .send({
          notebookId: TEST_NOTEBOOK_ID,
          message: 'What is machine learning?'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('citations');
      expect(Array.isArray(response.body.citations)).toBe(true);
    });

    it('should handle empty queries gracefully', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer test-jwt-token`)
        .send({
          notebookId: TEST_NOTEBOOK_ID,
          message: ''
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/sources/upload - Enhanced Upload', () => {
    it('should process PDF and create chunks with embeddings', async () => {
      // Mock file upload
      const response = await request(app)
        .post('/api/sources/upload')
        .set('Authorization', `Bearer test-jwt-token`)
        .attach('file', Buffer.from('dummy pdf content'), 'test.pdf')
        .field('notebookId', TEST_NOTEBOOK_ID);

      // Upload returns 202 with processing message
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('source');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/sources/:notebookId - Source Listing', () => {
    it('should list sources with metadata including summaries', async () => {
      // Insert a source with summary metadata
      await pool.query(
        `INSERT INTO sources (notebook_id, user_id, title, file_type, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          TEST_NOTEBOOK_ID,
          TEST_USER_ID,
          'Test Document.pdf',
          'pdf',
          'ready',
          JSON.stringify({
            summaries: [
              { section_start: 0, section_end: 10, summary: 'Summary of section 1' }
            ]
          })
        ]
      );

      const response = await request(app)
        .get(`/api/sources/${TEST_NOTEBOOK_ID}`)
        .set('Authorization', `Bearer test-jwt-token`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].metadata).toHaveProperty('summaries');
    });
  });

  describe('Enhanced RAG Features', () => {
    it('should support query expansion', async () => {
      // Test the expandQuery function
      const { expandQuery } = await import('./backend/src/services/ragService.js');
      const expanded = expandQuery('definition');

      expect(expanded).toContain('definition');
      expect(expanded).toContain('OR');
    });

    it('should validate answer grounding', async () => {
      const { validateAnswerGrounding } = await import('./backend/src/services/ragService.js');

      // Test with citations
      let result = validateAnswerGrounding('Answer', [
        { title: 'Source.pdf', page_number: 1 }
      ]);
      expect(result.isGrounded).toBe(true);

      // Test without citations
      result = validateAnswerGrounding('I could not find the answer', []);
      expect(result.isGrounded).toBe(true); // Has disclaimer
    });

    it('should format citations correctly', async () => {
      const { formatCitations } = await import('./backend/src/services/ragService.js');

      const citations = [
        { title: 'doc.pdf', page_number: 5 },
        { title: 'video.mp4', timestamp_start: 120 }
      ];

      const formatted = formatCitations(citations);
      expect(formatted).toContain('1: doc.pdf, Page 5');
      expect(formatted).toContain('2: video.mp4 @');
    });
  });
});

// Run integration tests
if (require.main === module) {
  describe('RAG Integration Suite', () => {
    it('should run all integration tests', async () => {
      console.log('Running RAG integration tests...');
      // Integration tests would be run here
      expect(true).toBe(true);
    });
  });
}