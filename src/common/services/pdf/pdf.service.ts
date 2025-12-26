// import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import * as Handlebars from 'handlebars';
// import * as fs from 'fs/promises';
// import * as path from 'path';
// import puppeteer from 'puppeteer';

// @Injectable()
// export class PdfService {
//   /**
//    * Render handlebars template (.hbs) -> HTML string
//    */
//   async renderTemplate(templateName: string, context: Record<string, any>) {
//     try {
//       const templatePath = path.join(
//         process.cwd(),
//         'src',
//         'common',
//         'services',
//         'pdf',
//         'templates',
//         `${templateName}.hbs`,
//       );

//       const raw = await fs.readFile(templatePath, 'utf-8');
//       const compiled = Handlebars.compile(raw);

//       return compiled(context);
//     } catch {
//       throw new InternalServerErrorException(
//         `Failed to render template: ${templateName}`,
//       );
//     }
//   }

//   /**
//    * HTML -> PDF Buffer
//    */
//   async htmlToPdfBuffer(html: string) {
//     let browser: puppeteer.Browser | null = null;

//     try {
//       browser = await puppeteer.launch({
//         // ini biasanya perlu kalau jalan di Docker/VPS
//         args: ['--no-sandbox', '--disable-setuid-sandbox'],
//       });

//       const page = await browser.newPage();
//       await page.setContent(html, { waitUntil: 'networkidle0' });

//       const pdf = await page.pdf({
//         format: 'A4',
//         printBackground: true,
//         margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
//       });

//       return Buffer.from(pdf);
//     } catch (err) {
//       throw new InternalServerErrorException('Failed to generate PDF');
//     } finally {
//       if (browser) await browser.close();
//     }
//   }

//   /**
//    * Shortcut: templateName + context => PDF buffer
//    */
//   async generateFromTemplate(
//     templateName: string,
//     context: Record<string, any>,
//   ) {
//     const html = await this.renderTemplate(templateName, context);
//     return this.htmlToPdfBuffer(html);
//   }
// }
